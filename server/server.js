// server/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { ethers } = require("ethers");

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || "defaultsecret";

// --- Security & Caching Middleware ---
// Disable the x-powered-by header so Express is not revealed.
app.disable("x-powered-by");

// Set Cache-Control header for static assets to a high max-age so updates use cache busting.
app.use((req, res, next) => {
  // Adjust max-age as needed; here we set 1 year for static resources.
  // You could use a conditional check (only set for assets) if needed.
  res.setHeader("Cache-Control", "public, max-age=31536000");
  next();
});

// Remove CSP header if it's not required. If you do need CSP, you can include one that allows eval if absolutely necessary:
// For example, if you MUST allow eval (not recommended), you can add 'unsafe-eval' in script-src.
// If not needed, simply do not set the Content-Security-Policy header.
app.use((req, res, next) => {
  // Option 1: Remove the CSP header completely
  // (Do not set any Content-Security-Policy header if your app does not require it.)
  // Option 2: Set a minimal CSP header without blocking eval, if necessary:
  // res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-eval'");
  next();
});

// --- Enable CORS and Body Parsing ---
app.use(cors());
app.use(bodyParser.json());

// Serve static files from the sibling folders
app.use(express.static(path.join(__dirname, '../views')));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/items', express.static(path.join(__dirname, '../items')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'index.html'));
});

/* =====================================================
   On-chain Settlement Setup via ethers.js
   ===================================================== */
const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC_URL);
const houseSigner = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const MET_ABI = [
  "function winBet(address player, uint256 amount) external",
  "function loseBet(address player, uint256 amount) external"
];
const MET_CONTRACT_ADDRESS = process.env.MET_CONTRACT_ADDRESS;
const metContract = new ethers.Contract(MET_CONTRACT_ADDRESS, MET_ABI, houseSigner);

/* =====================================================
   Off-chain Virtual Balance & Transaction Logging
   ===================================================== */
const userOffchainDeposit = {};
const userOffchainBalance = {};
let houseFunds = 0;
let transactions = [];

app.get('/api/user/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const deposit = parseFloat(userOffchainDeposit[wallet] || "0");
  const balance = parseFloat(userOffchainBalance[wallet] || "0");
  const total = deposit + balance;
  res.json({ wallet, deposit: deposit.toString(), balance: balance.toString(), total });
});

app.post('/api/deposit-offchain/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const { amount } = req.body;
  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: "Invalid deposit amount" });
  }
  let currentDeposit = parseFloat(userOffchainDeposit[wallet] || "0");
  currentDeposit += parseFloat(amount);
  userOffchainDeposit[wallet] = currentDeposit.toString();
  const logEntry = {
    address: wallet,
    amount: amount.toString(),
    type: "deposit",
    date: new Date()
  };
  transactions.push(logEntry);
  console.log("Logged deposit:", logEntry);
  res.json({ wallet, newDeposit: userOffchainDeposit[wallet], message: "Deposit recorded." });
});

app.post('/api/balance-change/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const { delta } = req.body;
  if (delta === undefined) {
    return res.status(400).json({ error: "delta is required" });
  }
  let currentBalance = parseFloat(userOffchainBalance[wallet] || "0");
  let change = parseFloat(delta);
  let newBalance = currentBalance + change;
  userOffchainBalance[wallet] = newBalance.toString();
  if (change < 0) {
    houseFunds += Math.abs(change);
    console.log(`House funds updated to: ${houseFunds}`);
  }
  const logEntry = {
    address: wallet,
    amount: delta.toString(),
    type: (change < 0) ? "bet_loss" : (change > 0 ? "win" : "neutral"),
    date: new Date()
  };
  transactions.push(logEntry);
  console.log("Logged balance change:", logEntry);
  res.json({ wallet, newBalance: userOffchainBalance[wallet] });
});

app.post('/api/player/reconcile', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: "Wallet is required" });
  const normalized = wallet.toLowerCase();
  const netChange = parseFloat(userOffchainBalance[normalized] || "0");
  console.log(`Reconciling for ${normalized}: netChange = ${netChange}`);
  let txResult = null;
  try {
    if (netChange > 0) {
      console.log(`Calling winBet() for net win of ${netChange} MET to ${normalized}`);
      txResult = await metContract.winBet(normalized, ethers.utils.parseUnits(netChange.toString(), 18));
    } else if (netChange < 0) {
      console.log(`Calling loseBet() for net loss of ${Math.abs(netChange)} MET from ${normalized}`);
      txResult = await metContract.loseBet(normalized, ethers.utils.parseUnits(Math.abs(netChange).toString(), 18));
    } else {
      return res.json({ wallet: normalized, netChange, message: "No net change; on-chain settlement not required." });
    }
    console.log("Awaiting on-chain confirmation...");
    const receipt = await txResult.wait();
    console.log("On-chain transaction confirmed:", receipt.transactionHash);
    transactions.push({
      address: normalized,
      amount: netChange.toString(),
      type: netChange < 0 ? "net loss" : "net win",
      date: new Date(),
      txHash: receipt.transactionHash
    });
    userOffchainBalance[normalized] = "0";
    res.json({
      wallet: normalized,
      netChange,
      txHash: receipt.transactionHash,
      message: netChange < 0
        ? `Player lost ${Math.abs(netChange)} MET on-chain.`
        : `Player won ${netChange} MET on-chain.`
    });
  } catch (error) {
    console.error("On-chain settlement failed:", error);
    res.status(500).json({ error: "On-chain settlement failed", details: error.message });
  }
});

app.get('/api/transactions', (req, res) => {
  res.json({ transactions });
});

app.get('/api/download-transactions', (req, res) => {
  let csvContent = "Address,Amount MET,Type,Date,TxHash\n";
  transactions.forEach(tx => {
    csvContent += `${tx.address},${tx.amount},${tx.type},${tx.date.toISOString()},${tx.txHash || ""}\n`;
  });
  const filePath = path.join(__dirname, '../transactions.csv');
  fs.writeFileSync(filePath, csvContent);
  res.download(filePath, 'transactions.csv', (err) => {
    if (err) {
      console.error("Error downloading transactions:", err);
    } else {
      console.log("Transactions downloaded; resetting logs.");
      transactions = [];
    }
    fs.unlinkSync(filePath);
  });
});

app.get('/api/admin/house-funds', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized, token required." });
  }
  const token = authHeader.split(" ")[1];
  try {
    jwt.verify(token, SECRET_KEY);
  } catch (error) {
    return res.status(401).json({ error: "Invalid token." });
  }
  res.json({ houseFunds: houseFunds.toString() });
});

app.post('/api/admin/cashout-house', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized, token required." });
  }
  const token = authHeader.split(" ")[1];
  try {
    jwt.verify(token, SECRET_KEY);
  } catch (error) {
    return res.status(401).json({ error: "Invalid token." });
  }
  if (houseFunds <= 0) {
    return res.status(400).json({ error: "No funds to cash out." });
  }
  const cashedOut = houseFunds;
  houseFunds = 0;
  res.json({ cashedOut: cashedOut.toString() });
});

let winPercentage = parseInt(process.env.WIN_PERCENT) || 30;
app.get('/api/get-win-percentage', (req, res) => {
  res.json({ percentage: winPercentage });
});
app.post('/api/set-win-percentage', (req, res) => {
  const { percentage } = req.body;
  if (typeof percentage === 'number' && percentage >= 0 && percentage <= 100) {
    winPercentage = percentage;
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid percentage value' });
  }
});

app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "2h" });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
