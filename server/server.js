// server/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || "defaultsecret";

app.use(cors());
app.use(bodyParser.json());

// Serve static files from the sibling folders (views, public, items)
app.use(express.static(path.join(__dirname, '../views')));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/items', express.static(path.join(__dirname, '../items')));

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'index.html'));
});

/* --------------------------------------------------
   Off-chain Virtual Credit Endpoints & Transaction Logging
   -------------------------------------------------- */

// In-memory store for individual user balances (keyed by wallet address)
const userBalances = {};
// Global variable to aggregate losses (house funds)
let houseFunds = 0;
// In-memory transaction log (array of transaction objects)
let transactions = [];

// GET a user's off-chain balance
app.get('/api/user/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const balance = userBalances[wallet] || "0";
  res.json({ wallet, balance });
});

/*
  POST endpoint to update a user's balance by a relative change.
  Expects: { "balanceChange": <number> }
  If the change is negative, it also adds that value to houseFunds.
  Balance is not allowed to go negative.
  Also, a transaction log is recorded.
*/
app.post('/api/user/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const { balanceChange } = req.body;
  if (balanceChange === undefined) {
    return res.status(400).json({ error: "balanceChange is required" });
  }
  let currentBalance = parseFloat(userBalances[wallet] || "0");
  let change = parseFloat(balanceChange);
  let newBalance = currentBalance + change;
  if (newBalance < 0) {
    change = -currentBalance;
    newBalance = 0;
  }
  userBalances[wallet] = newBalance.toString();

  // If the change is negative, add the absolute value to the global houseFunds.
  if (change < 0) {
    houseFunds += Math.abs(change);
  }

  // Log transaction (simple log for demo)
  transactions.push({
    address: wallet,
    amount: change.toString(),
    status: change < 0 ? "loss" : (change > 0 ? "win" : "neutral"),
    date: new Date()
  });

  res.json({ wallet, newBalance: userBalances[wallet] });
});

/*
  POST /api/player/reconcile
  Endpoint for session reconciliation.
  Expects: { "wallet": "<walletAddress>", "initialDeposit": <number>, "finalBalance": <number> }
  Calculates netChange = finalBalance - initialDeposit.
  Records a transaction log for reconciliation.
*/
app.post('/api/player/reconcile', (req, res) => {
  const { wallet, initialDeposit, finalBalance } = req.body;
  if (!wallet || initialDeposit === undefined || finalBalance === undefined) {
    return res.status(400).json({ error: "wallet, initialDeposit, and finalBalance are required" });
  }
  const normalizedWallet = wallet.toLowerCase();
  const netChange = parseFloat(finalBalance) - parseFloat(initialDeposit);
  
  // Log the reconciliation as a transaction.
  transactions.push({
    address: normalizedWallet,
    amount: netChange.toString(),
    status: netChange < 0 ? "net loss" : (netChange > 0 ? "net win" : "break-even"),
    date: new Date()
  });
  
  // In production, trigger on-chain actions here:
  // If netChange is negative (loss): deduct from player's on-chain balance (send tokens to house wallet)
  // If netChange is positive (win): transfer tokens from house wallet to player.
  // For now, just return the computed netChange.
  res.json({
    wallet: normalizedWallet,
    initialDeposit,
    finalBalance,
    netChange,
    message: netChange < 0
      ? `Player lost ${Math.abs(netChange)} MET. Loss goes to the house wallet.`
      : netChange > 0
        ? `Player won ${netChange} MET. Winnings will be transferred to the player.`
        : "No net change."
  });
});

/*
  GET endpoint for admin to view aggregated house funds
  Protected by JWT in the Authorization header.
*/
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

/*
  POST endpoint for admin to cash out the aggregated house funds.
  This resets houseFunds to 0.
  In production, trigger an on-chain transfer from the house wallet to the admin's wallet.
*/
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

/* --------------------------------------------------
   Other Endpoints (win percentage, transactions, admin login, etc.)
   -------------------------------------------------- */

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

// Admin login endpoint: returns JWT token.
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "2h" });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
});

// (Other endpoints such as /api/record-transaction could also be added.)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
