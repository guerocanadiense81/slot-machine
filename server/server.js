require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Web3 } = require("web3");
const bodyParser = require("body-parser");
const winston = require("winston");
const TelegramBot = require("node-telegram-bot-api");
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// Logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.File({ filename: "logs/transactions.log" })],
});

// Telegram Bot
const telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

// Web3 Setup
const { Web3 } = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.BSC_RPC_URL));
const tokenABI = require("../abi/METToken.json"); // ABI path
const contract = new web3.eth.Contract(tokenABI, process.env.MET_CONTRACT_ADDRESS);

// Globals
let paidWinPercent = parseInt(process.env.WIN_PERCENT) || 30;
let freeWinPercent = 30;

// Endpoint: Get BNB price via smart contract
app.get("/api/get-bnb-price", async (req, res) => {
  try {
    const price = await contract.methods.getLatestBNBPrice().call();
    res.json({ bnbPrice: parseFloat(price) / 1e8 }); // Chainlink format
  } catch (err) {
    logger.error("BNB Price Fetch Error", { error: err.message });
    res.status(500).json({ error: "Failed to fetch BNB price." });
  }
});

// Endpoint: Purchase MET tokens
app.post("/api/purchase", async (req, res) => {
  const { from, usdAmount } = req.body;
  if (!from || !usdAmount || isNaN(usdAmount)) {
    return res.status(400).json({ error: "Invalid request body." });
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
  } catch (error) {
    logger.error("PurchaseTokens Error", { error: error.message });
    res.status(500).json({ error: "Token purchase failed." });
  }
});

// Endpoint: Cash Out session
app.post("/api/settle-session", async (req, res) => {
  const { walletAddress, credits } = req.body;
  const payout = parseFloat(credits);

  if (!walletAddress || isNaN(payout) || payout <= 0) {
    return res.status(400).json({ error: "Invalid session data." });
  }

  const amount = web3.utils.toWei(payout.toString(), "ether");

  try {
    const tx = contract.methods.winBet(walletAddress, amount);
    const signed = await web3.eth.accounts.signTransaction(
      {
        to: process.env.MET_CONTRACT_ADDRESS,
        data: tx.encodeABI(),
        gas: 200000,
      },
      process.env.PRIVATE_KEY
    );

    const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);

    logger.info("Session Settled (win)", {
      wallet: walletAddress,
      amount: payout,
      tx: receipt.transactionHash,
    });

    // Telegram alert if win > threshold (e.g., > 500 MET)
    if (payout >= 500) {
      await telegramBot.sendMessage(
        process.env.TELEGRAM_CHAT_ID,
        `🎉 BIG WIN!\nUser: ${walletAddress}\nWinnings: ${payout} MET\nTx: https://bscscan.com/tx/${receipt.transactionHash}`
      );
    }

    res.json({ success: true, txHash: receipt.transactionHash });
  } catch (err) {
    logger.error("WinBet Error", { error: err.message });
    res.status(500).json({ error: "Cash out failed." });
  }
});

// Endpoint: Lose Bet
app.post("/api/record-loss", async (req, res) => {
  const { walletAddress, amount } = req.body;

  if (!walletAddress || isNaN(amount)) {
    return res.status(400).json({ error: "Missing wallet or amount." });
  }

  const lossAmount = web3.utils.toWei(amount.toString(), "ether");

  try {
    const tx = contract.methods.loseBet(walletAddress, lossAmount);
    const signed = await web3.eth.accounts.signTransaction(
      {
        to: process.env.MET_CONTRACT_ADDRESS,
        data: tx.encodeABI(),
        gas: 200000,
      },
      process.env.PRIVATE_KEY
    );
    const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);

    logger.info("Session Settled (loss)", {
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

// Endpoint: Admin login
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

// Endpoint: Get both free and paid win %
app.get("/api/get-win-percentages", (req, res) => {
  res.json({ free: freeWinPercent, paid: paidWinPercent });
});

// Endpoint: Admin updates win %
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

// Endpoint: Contact Form
app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Missing fields." });
  }

  logger.info("Contact Message", { name, email, message });
  res.json({ success: true });
});

// Fallback
app.get("*", (req, res) => res.send("Slot Machine API Running"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
