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

app.use(cors());
app.use(bodyParser.json());

// Serve static files from siblings (views, public, items)
app.use(express.static(path.join(__dirname, '../views')));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/items', express.static(path.join(__dirname, '../items')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'index.html'));
});

/* =====================================================
   On-chain Settlement Setup via ethers.js
   ===================================================== */
// Create provider and house signer
const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC_URL);
const houseSigner = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// ABI for winBet and loseBet functions on the MET token contract.
const MET_ABI = [
  "function winBet(address player, uint256 amount) external",
  "function loseBet(address player, uint256 amount) external"
];
const MET_CONTRACT_ADDRESS = process.env.MET_CONTRACT_ADDRESS;
const metContract = new ethers.Contract(MET_CONTRACT_ADDRESS, MET_ABI, houseSigner);

/* =====================================================
   Off-chain Virtual Balance and Logging
   ===================================================== */
// We maintain two mappings:
// 1. userOffchainDeposit: Locked deposit for each player (on-chain deposit).
// 2. userOffchainBalance: The net win/loss during gameplay (starts at 0).
const userOffchainDeposit = {};
const userOffchainBalance = {};

// Global variable to aggregate losses (house funds)
let houseFunds = 0;

// In-memory transaction log array
let transactions = [];

/*
  GET /api/user/:walletAddress
  Returns:
    - deposit: the locked deposit
    - balance: the net win/loss from gameplay
    - total: sum of deposit and balance (display purpose)
*/
app.get('/api/user/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const deposit = parseFloat(userOffchainDeposit[wallet] || "0");
  const balance = parseFloat(userOffchainBalance[wallet] || "0");
  const total = deposit + balance;
  res.json({ wallet, deposit, balance, total });
});

/*
  POST /api/deposit-offchain/:walletAddress
  Called when a player deposits tokens off chain (locked deposit).
  Expects: { "amount": number }
*/
app.post('/api/deposit-offchain/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const { amount } = req.body;
  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: "Invalid deposit amount" });
  }
  let currentDeposit = parseFloat(userOffchainDeposit[wallet] || "0");
  currentDeposit += parseFloat(amount);
  userOffchainDeposit[wallet] = currentDeposit.toString();
  // Log deposit transaction.
  const logEntry = {
    address: wallet,
    amount: amount.toString(),
    status: "deposit",
    date: new Date()
  };
  transactions.push(logEntry);
  console.log("Deposit logged:", logEntry);
  res.json({ wallet, newDeposit: userOffchainDeposit[wallet], message: "Deposit recorded." });
});

/*
  POST /api/balance-change/:walletAddress
  Called during gameplay to update off-chain win/loss.
  Expects: { "delta": number } where positive for wins and negative for losses.
*/
app.post('/api/balance-change/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const { delta } = req.body;
  if (delta === undefined) {
    return res.status(400).json({ error: "delta is required" });
  }
  let currentBalance = parseFloat(userOffchainBalance[wallet] || "0");
  let change = parseFloat(delta);
  let newBalance = currentBalance + change;
  // We can allow negative off-chain balances here, representing net losses.
  userOffchainBalance[wallet] = newBalance.toString();
  if (change < 0) {
    houseFunds += Math.abs(change);
  }
  const logEntry = {
    address: wallet,
    amount: delta.toString(),
    status: (change < 0) ? "loss" : (change > 0 ? "win" : "neutral"),
    date: new Date()
  };
  transactions.push(logEntry);
  console.log("Balance change logged:", logEntry);
  res.json({ wallet, newBalance: userOffchainBalance[wallet] });
});

/*
  POST /api/player/reconcile
  Called at session end.
  Expects: { "wallet": "<walletAddress>" }
  Uses the player's offchain deposit and offchain balance:
    netChange = userOffchainBalance (i.e., the plus/minus amount)
  If netChange > 0: winBet() is called.
  If netChange < 0: loseBet() is called.
  Then resets userOffchainBalance[wallet] to "0" (without affecting the deposit).
*/
app.post('/api/player/reconcile', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) {
    return res.status(400).json({ error: "Wallet is required" });
  }
  const normalizedWallet = wallet.toLowerCase();
  const netChange = parseFloat(userOffchainBalance[normalizedWallet] || "0");
  console.log(`Reconciling for ${normalizedWallet}: Net Change = ${netChange}`);
  let txResult = null;
  try {
    if (netChange > 0) {
      console.log(`winBet(): Transferring net win of ${netChange} MET to ${normalizedWallet}`);
      txResult = await metContract.winBet(normalizedWallet, ethers.utils.parseUnits(netChange.toString(), 18));
    } else if (netChange < 0) {
      console.log(`loseBet(): Deducting net loss of ${Math.abs(netChange)} MET from ${normalizedWallet}`);
      txResult = await metContract.loseBet(normalizedWallet, ethers.utils.parseUnits(Math.abs(netChange).toString(), 18));
    } else {
      return res.json({ wallet: normalizedWallet, netChange, message: "No net change; no on-chain settlement necessary." });
    }
    console.log("Waiting for on-chain confirmation...");
    const receipt = await txResult.wait();
    console.log("On-chain transaction confirmed:", receipt.transactionHash);
    transactions.push({
      address: normalizedWallet,
      amount: netChange.toString(),
      status: netChange < 0 ? "net loss" : "net win",
      date: new Date(),
      txHash: receipt.transactionHash
    });
    // Reset the player's off-chain balance after reconciliation.
    userOffchainBalance[normalizedWallet] = "0";
    res.json({
      wallet: normalizedWallet,
      netChange,
      txHash: receipt.transactionHash,
      message: netChange < 0
        ? `Player lost ${Math.abs(netChange)} MET; on-chain deduction executed.`
        : `Player won ${netChange} MET; on-chain transfer executed.`
    });
  } catch (error) {
    console.error("On-chain settlement failed:", error);
    res.status(500).json({ error: "On-chain settlement failed", details: error.message });
  }
});

/* =====================================================
   Admin Endpoints
   ===================================================== */

// GET /api/transactions – return the transaction log.
app.get('/api/transactions', (req, res) => {
  res.json({ transactions });
});

// GET /api/download-transactions – generate a CSV from transactions, send file, then reset logs.
app.get('/api/download-transactions', (req, res) => {
  let csvContent = "Address,Amount MET,Status,Date,TxHash\n";
  transactions.forEach(tx => {
    csvContent += `${tx.address},${tx.amount},${tx.status},${tx.date.toISOString()},${tx.txHash || ""}\n`;
  });
  const filePath = path.join(__dirname, '../transactions.csv');
  fs.writeFileSync(filePath, csvContent);
  res.download(filePath, 'transactions.csv', (err) => {
    if (err) {
      console.error("Error downloading transactions:", err);
    } else {
      console.log("Transactions downloaded successfully, resetting logs.");
      transactions = [];
    }
    fs.unlinkSync(filePath);
  });
});

// GET /api/admin/house-funds – returns aggregated house funds (protected by JWT)
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

// POST /api/admin/cashout-house – resets houseFunds to 0 (protected by JWT)
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

/* =====================================================
   Other Endpoints (Win Percentage, Admin Login)
   ===================================================== */
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

// Admin login endpoint: returns a JWT.
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
