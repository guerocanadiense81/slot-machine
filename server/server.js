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

// Since server.js is inside "server", use "../" to reach project root folders.
app.use(express.static(path.join(__dirname, '../views')));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/items', express.static(path.join(__dirname, '../items')));

// Home route to serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'index.html'));
});

/* ---------------------------------------------------------
   Off-chain Virtual Credit Endpoints
   --------------------------------------------------------- */

// In-memory store for user in‑game balances (keyed by wallet address)
// and aggregated house funds (losses).
const userBalances = {};
let houseFunds = 0;

// GET a user's off-chain balance
app.get('/api/user/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const balance = userBalances[wallet] || "0";
  res.json({ wallet, balance });
});

/*
  POST endpoint to update a user's balance by a relative change.
  Expects JSON: { "balanceChange": <number> }
  If the balanceChange is negative, that loss is added to houseFunds.
  The balance cannot go below 0.
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
    change = -currentBalance; // Only deduct the available funds
    newBalance = 0;
  }
  userBalances[wallet] = newBalance.toString();
  if (change < 0) {
    // Aggregate losses into houseFunds.
    houseFunds += Math.abs(change);
  }
  res.json({ wallet, newBalance: userBalances[wallet] });
});

/*
  GET endpoint for admin to view the aggregated house funds (losses)
  Protected by JWT (admin token)
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
  POST endpoint for admin to cash out the house funds.
  This resets the aggregated house funds to 0.
  (In production, this would trigger an on-chain MET token transfer from your house wallet.)
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
  // In production, you would add logic here to trigger an on-chain transfer.
  res.json({ cashedOut: cashedOut.toString() });
});

/* ---------------------------------------------------------
   Other Existing Endpoints (Win Percentage, Transactions, Admin Login, etc.)
   --------------------------------------------------------- */

let winPercentage = parseInt(process.env.WIN_PERCENT) || 30;
let transactions = [];

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

// Example admin login endpoint (returns JWT token)
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "2h" });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
});

// (Additional endpoints such as for transactions, contact, etc., can be added below.)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
