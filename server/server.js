require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const winston = require("winston");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");
const { Web3 } = require("web3");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

const tokenABI = require("../abi/METToken.json"); // Make sure this path is correct
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.BSC_RPC_URL));
const contract = new web3.eth.Contract(tokenABI, process.env.MET_CONTRACT_ADDRESS);

// Logging Setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.File({ filename: "logs/transactions.log" })],
});

// Telegram Alerts
const telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

// Globals
let paidWinPercent = parseInt(process.env.WIN_PERCENT) || 30;
let freeWinPercent = 30;

// === API ROUTES ===

// BNB Price
app.get("/api/get-bnb-price", async (req, res) => {
  try {
    const price = await contract.methods.getLatestBNBPrice().call();
    res.json({ bnbPrice: parseFloat(price) / 1e8 });
  } catch (err) {
    logger.error("Error getting BNB price", { error: err.message });
    res.status(500).json({ error: "Failed to fetch BNB price." });
  }
});

// Buy MET (purchaseTokens)
app.post("/api/purchase", async (req, res) => {
  const { from, usdAmount } = req.body;
  if (!from || isNaN(usdAmount)) {
    return res.status(400).json({ error: "Invalid purchase request." });
  }

  try {
    const amount = web3.utils.toWei(usdAmount.toString(), "ether");
    const tx = contract.methods.purchaseTokens(from, amount);
    const data = tx.encodeABI();

    const txObject = {
      to: process.env.MET_CONTRACT_ADDRESS,
      data,
      gas: 300000,
    };

    const signedTx = await web3.eth.accounts.signTransaction(txObject, process.env.PRIVATE_KEY);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    logger.info("MET Purchased", { from, usdAmount, hash: receipt.transactionHash });

    res.json({ success: true, txHash: receipt.transactionHash });
  } catch (err) {
    logger.error("Purchase error", { error: err.message });
    res.status(500).json({ error: "Token purchase failed." });
  }
});

// Settle Win
app.post("/api/settle-session", async (req, res) => {
  const { walletAddress, credits } = req.body;
  if (!walletAddress || isNaN(credits)) {
    return res.status(400).json({ error: "Invalid payout data." });
  }

  try {
    const amount = web3.utils.toWei(credits.toString(), "ether");
    const tx = contract.methods.winBet(walletAddress, amount);

    const signed = await web3.eth.accounts.signTransaction(
      { to: process.env.MET_CONTRACT_ADDRESS, data: tx.encodeABI(), gas: 200000 },
      process.env.PRIVATE_KEY
    );

    const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
    logger.info("WinBet executed", { walletAddress, credits, tx: receipt.transactionHash });

    if (credits >= 500) {
      await telegramBot.sendMessage(
        process.env.TELEGRAM_CHAT_ID,
        `🎉 BIG WIN\nUser: ${walletAddress}\nWinnings: ${credits} MET\nTx: https://bscscan.com/tx/${receipt.transactionHash}`
      );
    }

    res.json({ success: true, txHash: receipt.transactionHash });
  } catch (err) {
    logger.error("WinBet error", { error: err.message });
    res.status(500).json({ error: "Cash out failed." });
  }
});

// Record Loss
app.post("/api/record-loss", async (req, res) => {
  const { walletAddress, amount } = req.body;
  if (!walletAddress || isNaN(amount)) {
    return res.status(400).json({ error: "Invalid loss record." });
  }

  try {
    const lossAmount = web3.utils.toWei(amount.toString(), "ether");
    const tx = contract.methods.loseBet(walletAddress, lossAmount);

    const signed = await web3.eth.accounts.signTransaction(
      { to: process.env.MET_CONTRACT_ADDRESS, data: tx.encodeABI(), gas: 200000 },
      process.env.PRIVATE_KEY
    );

    const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
    logger.info("LoseBet executed", { walletAddress, amount, tx: receipt.transactionHash });

    res.json({ success: true, txHash: receipt.transactionHash });
  } catch (err) {
    logger.error("LoseBet error", { error: err.message });
    res.status(500).json({ error: "Loss transaction failed." });
  }
});

// Admin Login
app.post("/api/admin-login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(403).json({ error: "Unauthorized" });
  }
});

// Get Win Percentages
app.get("/api/get-win-percentages", (req, res) => {
  res.json({ free: freeWinPercent, paid: paidWinPercent });
});

// Update Win Percentages
app.post("/api/update-win-percentages", (req, res) => {
  const { free, paid } = req.body;
  if (isNaN(free) || isNaN(paid)) {
    return res.status(400).json({ error: "Invalid data" });
  }

  freeWinPercent = parseInt(free);
  paidWinPercent = parseInt(paid);

  logger.info("Updated Win Percentages", { free: freeWinPercent, paid: paidWinPercent });
  res.json({ success: true });
});

// Contact Form Submission
app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Missing fields." });
  }

  logger.info("Contact Form", { name, email, message });
  res.json({ success: true });
});

// Fallback
app.get("*", (req, res) => {
  res.send("🎰 Slot Machine API is running.");
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server is live on port ${PORT}`);
});
