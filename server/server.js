require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");
const Web3 = require('web3');
const winston = require("winston");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../assets")));
app.use(express.static(path.join(__dirname, "../views")));
app.use(express.static(path.join(__dirname, "../css")));
app.use(express.static(path.join(__dirname, "../js")));

const tokenABI = require("../abi/METToken.json");

// Web3 + Contract Setup
const web3 = new Web3(process.env.BSC_RPC_URL);
const contract = new web3.eth.Contract(tokenABI, process.env.MET_CONTRACT_ADDRESS);
const houseWallet = process.env.HOUSE_WALLET;
const privateKey = process.env.PRIVATE_KEY;

// Telegram Bot
const telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

// Logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.File({ filename: "logs/transactions.log" })],
});

// In-memory balances
let balances = {}; // { wallet: credits }

function addCredits(wallet, amount) {
  if (!balances[wallet]) balances[wallet] = 0;
  balances[wallet] += parseFloat(amount);
}

function subtractCredits(wallet, amount) {
  if (!balances[wallet]) balances[wallet] = 0;
  balances[wallet] -= parseFloat(amount);
  if (balances[wallet] < 0) balances[wallet] = 0;
}

// === ROUTES ===

// ✅ Get live BNB price
app.get("/api/get-bnb-price", async (req, res) => {
  try {
    const price = await contract.methods.getLatestBNBPrice().call();
    res.json({ bnbPrice: parseFloat(price) / 1e8 });
  } catch (err) {
    logger.error("BNB price fetch error", { error: err.message });
    res.status(500).json({ error: "BNB price unavailable." });
  }
});

// ✅ Confirm token purchase (after BNB sent)
app.post("/api/confirm-purchase", async (req, res) => {
  const { buyer, usdAmount } = req.body;
  if (!buyer || !usdAmount) return res.status(400).json({ error: "Missing buyer or amount" });

  try {
    const amount = web3.utils.toWei(usdAmount.toString(), "ether");
    const tx = contract.methods.purchaseTokens(buyer, amount);
    const gas = await tx.estimateGas({ from: houseWallet });
    const txData = tx.encodeABI();

    const signedTx = await web3.eth.accounts.signTransaction(
      { to: process.env.MET_CONTRACT_ADDRESS, data: txData, gas },
      privateKey
    );

    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    logger.info("MET Purchase Confirmed", { buyer, usdAmount, tx: receipt.transactionHash });

    res.json({ success: true, tx: receipt.transactionHash });
  } catch (err) {
    logger.error("PurchaseTokens Error", { error: err.message });
    res.status(500).json({ error: "Token transfer failed." });
  }
});

// ✅ Spin - Deduct credits, log outcome
app.post("/api/spin", (req, res) => {
  const { wallet, bet, result, winAmount } = req.body;
  if (!wallet || isNaN(bet)) return res.status(400).json({ error: "Invalid spin data" });

  subtractCredits(wallet, bet);
  if (winAmount && winAmount > 0) {
    addCredits(wallet, winAmount);
    logger.info("Spin Win", { wallet, bet, result, winAmount });
    if (winAmount >= 500) {
      telegramBot.sendMessage(
        process.env.TELEGRAM_CHAT_ID,
        `🎉 BIG WIN!\nWallet: ${wallet}\nWinnings: ${winAmount} MET`
      );
    }
  } else {
    logger.info("Spin Loss", { wallet, bet, result });
  }

  res.json({ success: true, credits: balances[wallet] });
});

// ✅ Get balance
app.post("/api/balance", (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: "Missing wallet" });
  const credits = balances[wallet] || 0;
  res.json({ credits });
});

// ✅ Cash out MET (on-chain)
app.post("/api/cashout", async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: "Missing wallet" });

  const amount = balances[wallet] || 0;
  if (amount <= 0) return res.status(400).json({ error: "No credits to cash out" });

  try {
    const weiAmount = web3.utils.toWei(amount.toString(), "ether");
    const tx = contract.methods.winBet(wallet, weiAmount);
    const gas = await tx.estimateGas({ from: houseWallet });
    const txData = tx.encodeABI();

    const signedTx = await web3.eth.accounts.signTransaction(
      { to: process.env.MET_CONTRACT_ADDRESS, data: txData, gas },
      privateKey
    );

    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    logger.info("Cashout Sent", { wallet, amount, tx: receipt.transactionHash });

    balances[wallet] = 0;
    res.json({ success: true, tx: receipt.transactionHash });
  } catch (err) {
    logger.error("Cashout Error", { error: err.message });
    res.status(500).json({ error: "Cashout failed." });
  }
});

// ✅ Send Bonus (Admin)
app.post("/api/send-bonus", (req, res) => {
  const { wallet, amount } = req.body;
  if (!wallet || isNaN(amount)) return res.status(400).json({ error: "Invalid data" });

  addCredits(wallet, amount);
  logger.info("Bonus Sent", { wallet, amount });
  res.json({ success: true });
});

// ✅ Export all balances to CSV
app.get("/api/export-balances", (req, res) => {
  const header = "wallet,credits\n";
  const rows = Object.entries(balances)
    .map(([wallet, balance]) => `${wallet},${balance.toFixed(2)}`)
    .join("\n");

  const csv = header + rows;
  const filePath = path.join(__dirname, "../logs/player-balances.csv");

  fs.writeFileSync(filePath, csv);
  res.download(filePath);
});

// ✅ Get all balances
app.get("/api/balances", (req, res) => {
  res.json(balances);
});

// ✅ Admin login (basic)
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

// ✅ Default fallback
app.get("*", (req, res) => {
  res.send("🎰 Slot Machine API Running.");
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
