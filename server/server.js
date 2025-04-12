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

// Serve static files (server.js is inside "server", so use "../" to refer to parent folders)
app.use(express.static(path.join(__dirname, '../views')));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/items', express.static(path.join(__dirname, '../items')));

// Serve home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'index.html'));
});

/* -------------------------------------------------
   Off-chain Virtual Credit Endpoints
   ------------------------------------------------- */

// In-memory store for player balances (keyed by wallet address)
const userBalances = {};

// Global variable to aggregate losses (house funds)
let houseFunds = 0;

// GET player's off-chain balance
app.get('/api/user/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const balance = userBalances[wallet] || "0";
  res.json({ wallet, balance });
});

/*
  POST endpoint to update a player's off-chain balance using a relative change.
  Expects { "balanceChange": <number> }.
  If the change is negative, that absolute amount adds to houseFunds.
  Balance is not allowed to go negative.
*/
app.post('/api/user/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const { balanceChange } = req.body;
  if (balanceChange === undefined) {
    return res.status(400).json({ error: "balanceChange is required" });
  }
  const currentBalance = parseFloat(userBalances[wallet] || "0");
  let change = parseFloat(balanceChange);
  let newBalance = currentBalance + change;
  if (newBalance < 0) {
    change = -currentBalance; // deduct only what is available
    newBalance = 0;
  }
  userBalances[wallet] = newBalance.toString();
  if (change < 0) {
    houseFunds += Math.abs(change);
  }
  res.json({ wallet, newBalance: userBalances[wallet] });
});

/*
  POST /api/player/reconcile 
  Reconciles a player’s session when they finish playing.
  Expects JSON: { "wallet": "<walletAddress>", "initialDeposit": <number>, "finalBalance": <number> }
  
  The netChange = finalBalance - initialDeposit.
  If netChange is negative, the player has a loss.
  If netChange is positive, the player has a win.
  (In production, trigger on-chain transfers accordingly.)
*/
app.post('/api/player/reconcile', (req, res) => {
  const { wallet, initialDeposit, finalBalance } = req.body;
  if (!wallet || initialDeposit === undefined || finalBalance === undefined) {
    return res.status(400).json({ error: "wallet, initialDeposit, and finalBalance are required" });
  }
  const normalizedWallet = wallet.toLowerCase();
  const netChange = parseFloat(finalBalance) - parseFloat(initialDeposit);
  
  // Here you would call smart contract functions to adjust on-chain balances.
  // For this demo, we simply return the netChange.
  
  res.json({
    wallet: normalizedWallet,
    initialDeposit,
    finalBalance,
    netChange,
    message: netChange < 0
      ? `Player lost ${Math.abs(netChange)} MET. Loss would be taken from player's on-chain balance.`
      : netChange > 0
        ? `Player won ${netChange} MET. Winnings would be transferred on-chain to the player.`
        : "No net change."
  });
});

/* -------------------------------------------------
   Other Endpoints (win percentage, transactions, admin login, etc.)
   ------------------------------------------------- */

let winPercentage = parseInt(process.env.WIN_PERCENT) || 30;
let transactions = [];

// Example endpoints for winPercentage and transaction logs...
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

// Optionally add other endpoints...

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
