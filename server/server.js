require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const winston = require("winston");
const TelegramBot = require("node-telegram-bot-api");
const { Web3 } = require("web3");
const tokenABI = require("../abi/METToken.json");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../views")));
app.use("/assets", express.static(path.join(__dirname, "../assets")));
app.use("/css", express.static(path.join(__dirname, "../css")));
app.use("/js", express.static(path.join(__dirname, "../js")));

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.File({ filename: "logs/transactions.log" })],
});

const telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.BSC_RPC_URL));
const contract = new web3.eth.Contract(tokenABI, process.env.MET_CONTRACT_ADDRESS);

let paidWinPercent = parseInt(process.env.WIN_PERCENT) || 30;
let freeWinPercent = 30;

app.get("/api/get-bnb-price", async (req, res) => {
  try {
    const price = await contract.methods.getLatestBNBPrice().call();
    res.json({ bnbPrice: parseFloat(price) / 1e8 });
  } catch (err) {
    logger.error("BNB Price Fetch Error", { error: err.message });
    res.status(500).json({ error: "Failed to fetch BNB price." });
  }
});

app.post("/api/confirm-purchase", async (req, res) => {
  const { walletAddress, usdAmount } = req.body;
  if (!walletAddress || isNaN(usdAmount)) {
    return res.status(400).json({ error: "Missing wallet or amount" });
  }

  try {
    const amount = web3.utils.toWei(usdAmount.toString(), "ether");
    const tx = contract.methods.purchaseTokens(walletAddress, amount);
    const signed = await web3.eth.accounts.signTransaction({
      to: process.env.MET_CONTRACT_ADDRESS,
      data: tx.encodeABI(),
      gas: 300000,
    }, process.env.PRIVATE_KEY);

    const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);

    logger.info("MET Purchase Confirmed", {
      wallet: walletAddress,
      usdAmount,
      tx: receipt.transactionHash,
    });

    res.json({ success: true, txHash: receipt.transactionHash });
  } catch (err) {
    logger.error("Confirm Purchase Error", { error: err.message });
    res.status(500).json({ error: "Token transfer failed." });
  }
});

app.post("/api/settle-session", async (req, res) => {
  const { walletAddress, credits } = req.body;
  const payout = parseFloat(credits);
  if (!walletAddress || isNaN(payout) || payout <= 0) {
    return res.status(400).json({ error: "Invalid session data." });
  }

  const amount = web3.utils.toWei(payout.toString(), "ether");

  try {
    const tx = contract.methods.winBet(walletAddress, amount);
    const signed = await web3.eth.accounts.signTransaction({
      to: process.env.MET_CONTRACT_ADDRESS,
      data: tx.encodeABI(),
      gas: 200000,
    }, process.env.PRIVATE_KEY);

    const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);

    logger.info("Session Settled (Win)", {
      wallet: walletAddress,
      amount: payout,
      tx: receipt.transactionHash,
    });

    if (payout >= 500) {
      await telegramBot.sendMessage(process.env.TELEGRAM_CHAT_ID,
        `🎉 BIG WIN!\nUser: ${walletAddress}\nWinnings: ${payout} MET\nTx: https://bscscan.com/tx/${receipt.transactionHash}`);
    }

    res.json({ success: true, txHash: receipt.transactionHash });
  } catch (err) {
    logger.error("WinBet Error", { error: err.message });
    res.status(500).json({ error: "Cash out failed." });
  }
});

app.post("/api/record-loss", async (req, res) => {
  const { walletAddress, amount } = req.body;
  if (!walletAddress || isNaN(amount)) {
    return res.status(400).json({ error: "Missing wallet or amount" });
  }

  const lossAmount = web3.utils.toWei(amount.toString(), "ether");

  try {
    const tx = contract.methods.loseBet(walletAddress, lossAmount);
    const signed = await web3.eth.accounts.signTransaction({
      to: process.env.MET_CONTRACT_ADDRESS,
      data: tx.encodeABI(),
      gas: 200000,
    }, process.env.PRIVATE_KEY);

    const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);

    logger.info("Session Settled (Loss)", {
      wallet: walletAddress,
      amount,
      tx: receipt.transactionHash,
    });

    res.json({ success: true, txHash: receipt.transactionHash });
  } catch (error) {
    logger.error("LoseBet Error", { error: error.message });
    res.status(500).json({ error: "Loss record failed." });
  }
});

app.get("/api/get-win-percentages", (req, res) => {
  res.json({ free: freeWinPercent, paid: paidWinPercent });
});

app.post("/api/update-win-percent", (req, res) => {
  const { type, percent } = req.body;
  if (!["free", "paid"].includes(type) || isNaN(percent)) {
    return res.status(400).json({ error: "Invalid request." });
  }

  if (type === "free") freeWinPercent = parseInt(percent);
  else paidWinPercent = parseInt(percent);

  logger.info("Win % Updated", { type, newValue: percent });
  res.json({ success: true });
});

app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Missing fields." });
  }

  logger.info("Contact Message", { name, email, message });
  res.json({ success: true });
});

app.post("/api/admin-login", (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    res.json({ success: true });
  } else {
    res.status(403).json({ error: "Unauthorized" });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
