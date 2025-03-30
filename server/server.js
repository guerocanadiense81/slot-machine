require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const Web3 = require("web3");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const winston = require("winston");

const app = express();
const PORT = process.env.PORT || 5000;

// Logging
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/transactions.log" }),
  ],
});

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../views")));
app.use("/assets", express.static(path.join(__dirname, "../assets")));
app.use("/css", express.static(path.join(__dirname, "../css")));
app.use("/js", express.static(path.join(__dirname, "../js")));

// Web3
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.BSC_RPC_URL));
const MET_CONTRACT_ADDRESS = process.env.MET_CONTRACT_ADDRESS;
const HOUSE_WALLET = process.env.HOUSE_WALLET_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ABI = require("../abi/METToken.json");

const metContract = new web3.eth.Contract(ABI, MET_CONTRACT_ADDRESS);

// In-memory balances
const userBalances = {}; // { wallet: Number }

// Auth middleware
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.sendStatus(403);
    req.user = decoded;
    next();
  });
}

// Route: Admin Login
app.post("/api/admin-login", (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign({ username }, process.env.JWT_SECRET, {
      expiresIn: "3h",
    });
    res.json({ token });
  } else {
    res.status(403).json({ error: "Invalid credentials" });
  }
});

// Route: Update Win %
let WIN_PERCENT = parseInt(process.env.WIN_PERCENT || "30");
let WIN_PERCENT_FREE = parseInt(process.env.WIN_PERCENT_FREE || "30");

app.post("/api/update-win-percentages", verifyToken, (req, res) => {
  const { paid, free } = req.body;
  if (!isNaN(paid)) WIN_PERCENT = paid;
  if (!isNaN(free)) WIN_PERCENT_FREE = free;
  logger.info(`Win percentages updated: Paid=${paid}% | Free=${free}%`);
  res.json({ success: true });
});

app.get("/api/get-win-percentages", (req, res) => {
  res.json({ paid: WIN_PERCENT, free: WIN_PERCENT_FREE });
});

// Route: Spin outcome (record loss)
app.post("/api/record-loss", (req, res) => {
  const { walletAddress, amount } = req.body;
  if (!walletAddress || !amount) return res.sendStatus(400);

  userBalances[walletAddress] = (userBalances[walletAddress] || 0) - amount;
  logger.info(`Loss recorded: ${walletAddress} lost ${amount} MET`);
  res.json({ success: true });
});

// Route: Win outcome (settle session)
app.post("/api/settle-session", (req, res) => {
  const { walletAddress, credits } = req.body;
  if (!walletAddress || typeof credits !== "number") return res.sendStatus(400);

  userBalances[walletAddress] = (userBalances[walletAddress] || 0) + credits;
  logger.info(`Win recorded: ${walletAddress} won ${credits} MET`);
  res.json({ success: true });
});

// 🆕 Route: Confirm Purchase (BNB sent to house wallet)
app.post("/api/confirm-purchase", async (req, res) => {
  const { buyer, usdAmount } = req.body;
  if (!buyer || !usdAmount) return res.status(400).json({ error: "Missing data" });

  try {
    const amount = web3.utils.toWei(usdAmount.toString(), "ether");

    const tx = metContract.methods.transfer(buyer, amount);
    const gas = await tx.estimateGas({ from: HOUSE_WALLET });
    const data = tx.encodeABI();
    const txData = {
      from: HOUSE_WALLET,
      to: MET_CONTRACT_ADDRESS,
      gas,
      data,
    };

    const signedTx = await web3.eth.accounts.signTransaction(txData, PRIVATE_KEY);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    logger.info(`MET sent to ${buyer} for $${usdAmount}. TX: ${receipt.transactionHash}`);
    res.json({ success: true, txHash: receipt.transactionHash });
  } catch (err) {
    logger.error("Error sending MET: " + err.message);
    res.status(500).json({ error: "Blockchain transaction failed." });
  }
});

// 🆕 Route: Admin Sends Bonus to Wallet
app.post("/api/send-bonus", verifyToken, (req, res) => {
  const { wallet, amount } = req.body;
  if (!wallet || isNaN(amount)) return res.status(400).json({ error: "Invalid input" });

  userBalances[wallet] = (userBalances[wallet] || 0) + amount;
  logger.info(`🎁 Bonus: ${wallet} +${amount} MET`);
  res.json({ success: true });
});

// 🆕 Route: Get all off-chain user balances
app.get("/api/get-balances", verifyToken, (req, res) => {
  res.json(userBalances);
});

// 🆕 Route: Download log CSV
app.get("/api/export-logs", verifyToken, (req, res) => {
  const logPath = path.join(__dirname, "../logs/transactions.log");
  if (!fs.existsSync(logPath)) return res.status(404).send("No logs yet.");
  res.download(logPath, "transactions.log");
});

// Route: Get current BNB price
app.get("/api/get-bnb-price", async (req, res) => {
  try {
    const data = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd");
    const json = await data.json();
    const price = json.binancecoin.usd;
    res.json({ bnbPrice: price });
  } catch (err) {
    logger.error("BNB price fetch failed: " + err.message);
    res.status(500).json({ error: "Failed to fetch BNB price" });
  }
});

// Contact form
app.post("/api/contact", async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.sendStatus(400);

  const TELEGRAM_BOT = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID;
  const text = `📩 New Contact:\nName: ${name}\nEmail: ${email}\nMsg: ${message}`;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text }),
    });
    res.json({ success: true });
  } catch (err) {
    logger.error("Contact form error: " + err.message);
    res.status(500).json({ error: "Message failed to send" });
  }
});

// Fallback for HTML views
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../views/index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🎰 Server running on http://localhost:${PORT}`);
});
