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

// Serve static files from the folders relative to project root
app.use(express.static(path.join(__dirname, '../views')));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/items', express.static(path.join(__dirname, '../items')));

// Explicit route for the homepage: use index.html from the views folder
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'index.html'));
});

/* ================================
   Off-Chain Virtual Credit Endpoints
   ================================ */

// In-memory store for user in-game MET balances (use a real database in production)
const userBalances = {};

// GET: Retrieve a user's balance by wallet address
app.get('/api/user/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const balance = userBalances[wallet] || "0";
  res.json({ wallet, balance });
});

// POST: Update (or set) a user's balance by wallet address
app.post('/api/user/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const { balance } = req.body;
  if (balance === undefined) {
    return res.status(400).json({ error: "Balance is required" });
  }
  // Store balance as a string to avoid precision issues
  userBalances[wallet] = balance.toString();
  res.json({ wallet, newBalance: userBalances[wallet] });
});

/* ================================
   Other existing endpoints (for win percentage, transactions, admin, etc.)
   ================================ */

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

app.post('/api/record-transaction', (req, res) => {
  const { address, amount, status } = req.body;
  transactions.push({ address, amount, status, date: new Date() });
  res.json({ success: true });
});

app.get('/api/transactions', (req, res) => {
  res.json({ transactions });
});

app.get('/api/download-transactions', (req, res) => {
  let csvContent = "Address,Amount MET,Status,Date\n";
  transactions.forEach(tx => {
    csvContent += `${tx.address},${tx.amount},${tx.status},${tx.date}\n`;
  });
  const filePath = path.join(__dirname, '../transactions.csv');
  fs.writeFileSync(filePath, csvContent);
  res.download(filePath, 'transactions.csv', () => fs.unlinkSync(filePath));
});

// Admin login and contact endpoints here (omitted for brevity)
// ...

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
