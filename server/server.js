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

// Since server.js is in the /server folder, use "../" to refer to files at the project root.
app.use(express.static(path.join(__dirname, '../views')));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/items', express.static(path.join(__dirname, '../items')));

// Explicit route to serve index.html as the homepage.
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'index.html'));
});

/* --------------------------------------------------
   Off-chain Virtual Credit Endpoints
   -------------------------------------------------- */

// Using an in-memory object for demonstration (replace with a real database in production)
const userBalances = {};

// GET a user's balance by wallet address (case-insensitive)
app.get('/api/user/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const balance = userBalances[wallet] || "0";
  res.json({ wallet, balance });
});

/* 
  POST endpoint to update a user's balance relative to their current balance.
  Expects a JSON body: { "balanceChange": <number> }
  A positive value adds tokens; a negative value subtracts tokens.
*/
app.post('/api/user/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const { balanceChange } = req.body;
  if (balanceChange === undefined) {
    return res.status(400).json({ error: "balanceChange is required" });
  }
  const currentBalance = parseFloat(userBalances[wallet] || "0");
  let newBalance = currentBalance + parseFloat(balanceChange);
  userBalances[wallet] = newBalance.toString();
  res.json({ wallet, newBalance: userBalances[wallet] });
});

/* 
  Cash Out Endpoint:
  When a player wishes to cash out, this endpoint is called.
  For demo, it simply resets their off-chain balance to 0 and returns the cashed-out amount.
  In production, here you would trigger an on-chain transaction transferring MET tokens to the player's wallet.
*/
app.post('/api/cashout/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  let currentBalance = parseFloat(userBalances[wallet] || "0");
  if (currentBalance <= 0) {
    return res.status(400).json({ error: "No balance to cash out." });
  }
  // In production, trigger the on-chain cash-out process here.
  userBalances[wallet] = "0";
  res.json({ wallet, cashedOut: currentBalance });
});

/* --------------------------------------------------
   (Other endpoints like winPercentage, transactions, admin login, contact, etc.)
   -------------------------------------------------- */

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

// (Other endpoints for transactions, admin login, etc., go here)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
