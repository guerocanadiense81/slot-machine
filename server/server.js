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

// Serve static files from the project root directories (adjusting ".." because server.js is in /server)
app.use(express.static(path.join(__dirname, '../views')));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/items', express.static(path.join(__dirname, '../items')));

// Explicit route for home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'index.html'));
});

/* ---------------------------
   Off-chain Virtual Credit Endpoints
   --------------------------- */

// Using an in-memory store for demo purposes (replace with a persistent database in production)
const userBalances = {};

// GET a user's off-chain balance using their wallet address (case-insensitive)
app.get('/api/user/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const balance = userBalances[wallet] || "0";
  res.json({ wallet, balance });
});

/*
  POST endpoint to update a user's balance.
  The client sends { "balanceChange": <number> }.
  If the balance change would result in a negative balance, we set it to 0.
*/
app.post('/api/user/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const { balanceChange } = req.body;
  if (balanceChange === undefined) {
    return res.status(400).json({ error: "balanceChange is required" });
  }
  let currentBalance = parseFloat(userBalances[wallet] || "0");
  let newBalance = currentBalance + parseFloat(balanceChange);
  if (newBalance < 0) newBalance = 0; // Prevent negative balance
  userBalances[wallet] = newBalance.toString();
  res.json({ wallet, newBalance: userBalances[wallet] });
});

/*
  Cash Out Endpoint (Admin Only)
  Expects a valid JWT token in the "Authorization" header in the form "Bearer <token>"
  and a JSON body with { "wallet": "<playerWalletAddress>" }.
  This endpoint simulates an on-chain cash-out:
  • It resets the player's off-chain balance to 0.
  • In production, you would trigger an on-chain transfer of MET tokens.
*/
app.post('/api/admin/cashout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized, token required" });
  }
  const token = authHeader.split(" ")[1];
  try {
    jwt.verify(token, SECRET_KEY);
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { wallet } = req.body;
  if (!wallet) {
    return res.status(400).json({ error: "wallet is required in body" });
  }
  const normalizedWallet = wallet.toLowerCase();
  let currentBalance = parseFloat(userBalances[normalizedWallet] || "0");
  if (currentBalance <= 0) {
    return res.status(400).json({ error: "No balance to cash out." });
  }
  // In a production environment, trigger the on-chain transfer here
  // For demo, we simply reset the off-chain balance to 0 and return the amount cashed out.
  userBalances[normalizedWallet] = "0";
  res.json({ wallet: normalizedWallet, cashedOut: currentBalance });
});

/* ---------------------------
   Other Existing Endpoints (win percentage, transactions, admin login, contact, etc.)
   --------------------------- */

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

// Example endpoint for admin login (returns a JWT token)
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "2h" });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
});

// (Other endpoints like /api/record-transaction, /api/transactions, etc. can go here.)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
