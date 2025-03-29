require("dotenv").config();
const jwt = require("jsonwebtoken");
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");
const winston = require("winston");
const bodyParser = require("body-parser");
const Web3 = require('web3');
const tokenABI = require("../abi/METToken.json");

const app = express();

app.use(cors());
app.use(bodyParser.json());

// ✅ Serve static frontend folders
app.use("/assets", express.static(path.join(__dirname, "../assets")));
app.use("/css", express.static(path.join(__dirname, "../css")));
app.use("/js", express.static(path.join(__dirname, "../js")));
app.use("/abi", express.static(path.join(__dirname, "../abi")));

// ✅ Serve HTML pages from /views
const serveView = (page) => (req, res) =>
  res.sendFile(path.join(__dirname, `../views/${page}`));

app.get("/", serveView("index.html"));
app.get("/index.html", serveView("index.html"));
app.get("/paid.html", serveView("paid.html"));
app.get("/admin.html", serveView("admin.html"));
app.get("/admin-login.html", serveView("admin-login.html"));
app.get("/contact.html", serveView("contact.html"));
app.get("/about.html", serveView("about.html"));
app.get("/instructions.html", serveView("instructions.html"));

// ✅ Logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.File({ filename: "logs/transactions.log" })],
});

// ✅ Telegram
const telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

// ✅ Web3 Setup
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.BSC_RPC_URL));
const contract = new web3.eth.Contract(tokenABI, process.env.MET_CONTRACT_ADDRESS);

// ✅ Globals
let paidWinPercent = parseInt(process.env.WIN_PERCENT) || 30;
let freeWinPercent = 30;

// === API Routes ===

// Get BNB price
app.get("/api/get-bnb-price", async (req, res) => {
  try {
    const price = await contract.methods.getLatestBNBPrice().call();
    res.json({ bnbPrice: parseFloat(price) / 1e8 });
  } catch (err) {
    logger.error("BNB Price Fetch Error", { error: err.message });
    res.status(500).json({ error: "Failed to fetch BNB price." });
  }
});

// Purchase MET tokens
app.post("/api/purchase", async (req, res) => {
  const { from, usdAmount } = req.body;
  if (!from || !usdAmount || isNaN(usdAmount)) {
    return res.status(400).json({ error: "Invalid request body." });
  }

  try {
    const amount = web3.utils.toWei(usdAmount.toString(), "ether");
    const tx = contract.methods.purchaseTokens(from, amount);
    const signedTx = await web3.eth.accounts.signTransaction(
      {
        to: process.env.MET_CONTRACT_ADDRESS,
        data: tx.encodeABI(),
        gas: 300000,
      },
      process.env.PRIVATE_KEY
    );

    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    logger.info("MET Purchased", { from, usdAmount, hash: receipt.transactionHash });
    res.json({ success: true, txHash: receipt.transactionHash });
  } catch (error) {
    logger.error("PurchaseTokens Error", { error: error.message });
    res.status(500).json({ error: "Token purchase failed." });
  }
});

// Win session
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

// Loss session
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

// Admin login
app.post("/api/admin-login", (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign({ user: username }, process.env.JWT_SECRET, {
      expiresIn: "2h",
    });
    res.json({ token });
  } else {
    res.status(403).json({ error: "Unauthorized" });
  }
});

// Get win percentages
app.get("/api/get-win-percentages", (req, res) => {
  res.json({ free: freeWinPercent, paid: paidWinPercent });
});

// Update win percentages
app.post("/api/update-win-percentages", (req, res) => {
  const { free, paid } = req.body;
  if (isNaN(free) || isNaN(paid)) {
    return res.status(400).json({ error: "Invalid input" });
  }
  freeWinPercent = parseInt(free);
  paidWinPercent = parseInt(paid);
  logger.info("Win Percentages Updated", { free, paid });
  res.json({ success: true });
});

// Contact form
app.post("/api/contact", (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Missing fields." });
  }

  logger.info("Contact Message", { name, email, message });
  res.json({ success: true });
});

// Fallback
app.use((req, res) => {
  res.status(404).send("404 - Page Not Found");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Slot Machine API running on port ${PORT}`));

app.use((req, res) => {
  res.status(404).send("404 - Page Not Found");
});

