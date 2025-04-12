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

// Serve static files from sibling folders (views, public, items)
app.use(express.static(path.join(__dirname, '../views')));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/items', express.static(path.join(__dirname, '../items')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'index.html'));
});

/* =====================================================
   On-chain Settlement Setup via ethers.js
   ===================================================== */
// Set up provider and house signer (ensure PRIVATE_KEY has the right roles)
const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC_URL);
const houseSigner = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Minimal ABI: our MET token contract should implement these functions.
const MET_ABI = [
  "function winBet(address player, uint256 amount) external",
  "function loseBet(address player, uint256 amount) external"
];
const MET_CONTRACT_ADDRESS = process.env.MET_CONTRACT_ADDRESS;
const metContract = new ethers.Contract(MET_CONTRACT_ADDRESS, MET_ABI, houseSigner);

/* =====================================================
   Off-chain Virtual Balance and Transaction Logging
   ===================================================== */
// We'll hold two mappings:
// - userOffchainDeposit: stores the player's locked deposit (on-chain deposit amount)
// - userOffchainBalance: stores net wins/losses from gameplay (can be negative)
const userOffchainDeposit = {};
const userOffchainBalance = {};

// Global variable to aggregate losses (from bets deducted)
let houseFunds = 0;

// In-memory transaction log (an array of objects)
let transactions = [];

/*
  GET /api/user/:walletAddress
  Returns:
    - deposit: locked deposit amount (as a string)
    - balance: net play balance (as a string)
    - total: deposit + balance (number)
*/
app.get('/api/user/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const deposit = parseFloat(userOffchainDeposit[wallet] || "0");
  const balance = parseFloat(userOffchainBalance[wallet] || "0");
  const total = deposit + balance;
  res.json({ wallet, deposit: deposit.toString(), balance: balance.toString(), total });
});

/*
  POST /api/deposit-offchain/:walletAddress
  Called when a player deposits tokens on chain.
  Expects: { "amount": number }
  This sets the locked deposit.
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
  // Log deposit with type "deposit"
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

/*
  POST /api/balance-change/:walletAddress
  Called during gameplay to update net play balance.
  Expects: { "delta": number } (e.g. -bet for a bet, +win for a win)
  Negative values are considered losses.
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
  userOffchainBalance[wallet] = newBalance.toString();
  if (change < 0) {
    houseFunds += Math.abs(change);
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

/*
  POST /api/player/reconcile
  Called at session end. Expects: { "wallet": "<walletAddress>" }
  The net change equals the net play balance (userOffchainBalance).
  If netChange > 0, winBet() is called; if negative, loseBet() is called.
  After reconciliation, the net play balance is reset to 0.
*/
app.post('/api/player/reconcile', async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: "Wallet is required" });
  const normalized = wallet.toLowerCase();
  const netChange = parseFloat(userOffchainBalance[normalized] || "0");
  console.log(`Reconciling for ${normalized}: netChange = ${netChange}`);
  let txResult = null;
  try {
    if (netChange > 0) {
      console.log(`winBet: Transferring net win of ${netChange} MET to ${normalized}`);
      txResult = await metContract.winBet(normalized, ethers.utils.parseUnits(netChange.toString(), 18));
    } else if (netChange < 0) {
      console.log(`loseBet: Deducting net loss of ${Math.abs(netChange)} MET from ${normalized}`);
      txResult = await metContract.loseBet(normalized, ethers.utils.parseUnits(Math.abs(netChange).toString(), 18));
    } else {
      return res.json({ wallet: normalized, netChange, message: "No net change; on-chain settlement not necessary." });
    }
    console.log("Awaiting on-chain transaction confirmation...");
    const receipt = await txResult.wait();
    console.log("On-chain transaction confirmed:", receipt.transactionHash);
    transactions.push({
      address: normalized,
      amount: netChange.toString(),
      type: netChange < 0 ? "net loss" : "net win",
      date: new Date(),
      txHash: receipt.transactionHash
    });
    // Reset net play balance after reconciliation.
    userOffchainBalance[normalized] = "0";
    res.json({
      wallet: normalized,
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
// GET transaction logs
app.get('/api/transactions', (req, res) => {
  res.json({ transactions });
});

// GET download transactions as CSV and reset logs.
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

// GET aggregated house funds (protected by JWT)
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

// POST cashout for house funds (protected by JWT)
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

// Admin login endpoint - returns a JWT token.
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
