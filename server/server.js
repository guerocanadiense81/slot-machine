// /server/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const Web3 = require("web3");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const winston = require("winston");

// ✅ Environment variable validation
if (!process.env.PORT) throw new Error('Missing required env var: PORT');
if (!process.env.BSC_RPC_URL) throw new Error('Missing required env var: BSC_RPC_URL');
if (!process.env.MET_WALLET_ADDRESS) throw new Error('Missing required env var: MET_WALLET_ADDRESS');
if (!process.env.MET_CONTRACT_ADDRESS) throw new Error('Missing required env var: MET_CONTRACT_ADDRESS');
if (!process.env.HOUSE_WALLET_ADDRESS) throw new Error('Missing required env var: HOUSE_WALLET_ADDRESS');
if (!process.env.BNB_FEES_WALLET_ADDRESS) throw new Error('Missing required env var: BNB_FEES_WALLET_ADDRESS');
if (!process.env.ADMIN_USERNAME) throw new Error('Missing required env var: ADMIN_USERNAME');
if (!process.env.ADMIN_PASSWORD) throw new Error('Missing required env var: ADMIN_PASSWORD');
if (!process.env.JWT_SECRET) throw new Error('Missing required env var: JWT_SECRET');
if (!process.env.WIN_PERCENT) throw new Error('Missing required env var: WIN_PERCENT');
if (!process.env.WIN_PERCENT_FREE) throw new Error('Missing required env var: WIN_PERCENT_FREE');
if (!process.env.PRIVATE_KEY) throw new Error('Missing required env var: PRIVATE_KEY');

const app = express();
app.use(cors());
app.use(bodyParser.json());
// Serve frontend files (views, assets, css, js)
app.use(express.static(path.join(__dirname, "../views")));
app.use("/assets", express.static(path.join(__dirname, "../assets")));
app.use("/css", express.static(path.join(__dirname, "../css")));
app.use("/js", express.static(path.join(__dirname, "../js")));

const PORT = process.env.PORT || 5000;

// Setup Winston logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/transactions.log" }),
  ],
});

// Initialize Web3
const web3 = new Web3(process.env.BSC_RPC_URL);
const MET_CONTRACT_ADDRESS = process.env.MET_CONTRACT_ADDRESS;
const HOUSE_WALLET = process.env.HOUSE_WALLET_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Load the ABI from file
const MET_ABI = require("../abi/METToken.json");
const metContract = new web3.eth.Contract(MET_ABI, MET_CONTRACT_ADDRESS);

// In-memory off-chain balance tracker for hybrid gameplay
const userBalances = {}; // e.g., { "0xabc...": 50 }

// JWT Admin Middleware
function verifyAdmin(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "Forbidden" });
    req.admin = decoded;
    next();
  });
}

// API: Admin Login
app.post("/api/admin-login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: "3h" });
    res.json({ success: true, token });
  } else {
    res.status(403).json({ error: "Invalid credentials" });
  }
});

// API: Update Win Percentages (admin-protected)
let WIN_PERCENT_PAID = parseInt(process.env.WIN_PERCENT) || 30;
let WIN_PERCENT_FREE = parseInt(process.env.WIN_PERCENT_FREE) || 30;
app.post("/api/update-win-percentages", verifyAdmin, (req, res) => {
  const { paid, free } = req.body;
  if (!isNaN(paid)) WIN_PERCENT_PAID = paid;
  if (!isNaN(free)) WIN_PERCENT_FREE = free;
  logger.info(`Win percentages updated: Paid=${paid}% Free=${free}%`);
  res.json({ success: true });
});
app.get("/api/get-win-percentages", (req, res) => {
  res.json({ paid: WIN_PERCENT_PAID, free: WIN_PERCENT_FREE });
});

// API: Record spin outcome (off-chain balance update)
app.post("/api/spin", (req, res) => {
  const { wallet, bet, result, win } = req.body;
  if (!wallet || !bet) return res.status(400).json({ success: false });
  // Deduct bet
  userBalances[wallet] = (userBalances[wallet] || 0) - bet;
  if (win && win > 0) {
    userBalances[wallet] += win;
    logger.info(`Win: ${wallet} wins ${win} MET on bet ${bet}`);
  } else {
    logger.info(`Loss: ${wallet} lost ${bet} MET`);
  }
  res.json({ success: true, newCredits: userBalances[wallet] });
});

// API: Get user's off-chain balance
app.get("/api/balance", (req, res) => {
  const wallet = req.query.wallet;
  if (!wallet) return res.status(400).json({ error: "Missing wallet" });
  res.json({ credits: userBalances[wallet] || 0 });
});

// API: Get all off-chain balances (admin)
app.get("/api/get-balances", verifyAdmin, (req, res) => {
  res.json(userBalances);
});

// API: Cashout – settle player's final balance on-chain
app.post("/api/cashout", async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: "Missing wallet" });
  const amount = userBalances[wallet] || 0;
  if (amount <= 0) return res.status(400).json({ error: "No credits to cashout" });

  const weiAmount = web3.utils.toWei(amount.toString(), "ether");
  try {
    const tx = metContract.methods.winBet(wallet, weiAmount);
    const gas = await tx.estimateGas({ from: HOUSE_WALLET });
    const txData = tx.encodeABI();
    const nonce = await web3.eth.getTransactionCount(HOUSE_WALLET);
    const signedTx = await web3.eth.accounts.signTransaction(
      { to: MET_CONTRACT_ADDRESS, data: txData, gas, nonce, chainId: 56 },
      PRIVATE_KEY
    );
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    logger.info(`Cashout: ${wallet} cashed out ${amount} MET. TX: ${receipt.transactionHash}`);
    userBalances[wallet] = 0;
    res.json({ success: true, txHash: receipt.transactionHash });
  } catch (err) {
    logger.error("Cashout error: " + err.message);
    res.status(500).json({ error: "Cashout failed" });
  }
});

// API: Confirm Purchase – triggered after player sends BNB to buy MET
app.post("/api/confirm-purchase", async (req, res) => {
  const { buyer, usdAmount } = req.body;
  if (!buyer || !usdAmount) return res.status(400).json({ error: "Missing data" });
  try {
    const amountWei = web3.utils.toWei(usdAmount.toString(), "ether");
    const tx = metContract.methods.purchaseTokens(buyer, amountWei);
    const gas = await tx.estimateGas({ from: HOUSE_WALLET });
    const txData = tx.encodeABI();
    const nonce = await web3.eth.getTransactionCount(HOUSE_WALLET);
    const signedTx = await web3.eth.accounts.signTransaction(
      { to: MET_CONTRACT_ADDRESS, data: txData, gas, nonce, chainId: 56 },
      PRIVATE_KEY
    );
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    // Update off-chain balance accordingly
    userBalances[buyer] = (userBalances[buyer] || 0) + parseFloat(usdAmount);
    logger.info(`Purchase: Sent ${usdAmount} MET to ${buyer} | TX: ${receipt.transactionHash}`);
    res.json({ success: true, txHash: receipt.transactionHash });
  } catch (err) {
    logger.error("Confirm purchase error: " + err.message);
    res.status(500).json({ error: "Purchase confirmation failed" });
  }
});

// API: Send Bonus (admin)
app.post("/api/send-bonus", verifyAdmin, (req, res) => {
  const { wallet, amount } = req.body;
  if (!wallet || isNaN(amount)) return res.status(400).json({ error: "Invalid input" });
  userBalances[wallet] = (userBalances[wallet] || 0) + parseFloat(amount);
  logger.info(`Bonus: Sent bonus of ${amount} MET to ${wallet}`);
  res.json({ success: true });
});

// API: Export logs as CSV
app.get("/api/export-logs", verifyAdmin, (req, res) => {
  const logFile = path.join(__dirname, "../logs/transactions.log");
  if (!fs.existsSync(logFile)) return res.status(404).send("No logs found.");
  res.download(logFile, "transactions.csv");
});

// API: Contact Form
app.post("/api/contact", async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: "Missing fields" });
  const text = `New Contact:\nName: ${name}\nEmail: ${email}\nMessage: ${message}`;
  const telegramUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
    });
    logger.info(`Contact: Message from ${name} (${email})`);
    res.json({ success: true });
  } catch (err) {
    logger.error("Contact error: " + err.message);
    res.status(500).json({ error: "Failed to send contact message" });
  }
});

// Fallback: serve index.html for unknown routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/index.html"));
});

app.listen(PORT, () => {
  console.log(`🎰 Server running on port ${PORT}`);
});
