// server/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { ethers } = require("ethers");

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || "defaultsecret";

app.use(cors());
app.use(bodyParser.json());

// Serve static files (since server.js is in the "server" folder, use "../" to refer to sibling folders)
app.use(express.static(path.join(__dirname, '../views')));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/items', express.static(path.join(__dirname, '../items')));

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'index.html'));
});

/* =====================================================
   On-chain Settlement Setup via ethers.js
   ===================================================== */

// Create an ethers provider and house signer (using PRIVATE_KEY)
const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC_URL);
const houseSigner = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Minimal ABI for winBet and loseBet functions
const MET_ABI = [
  "function winBet(address player, uint256 amount) external",
  "function loseBet(address player, uint256 amount) external"
];
const MET_CONTRACT_ADDRESS = process.env.MET_CONTRACT_ADDRESS;
const metContract = new ethers.Contract(MET_CONTRACT_ADDRESS, MET_ABI, houseSigner);

/* =====================================================
   Off-chain Virtual Balance & Transaction Log Endpoints
   ===================================================== */

// In-memory store for each player’s balance (keyed by wallet address)
const userBalances = {};  
// Global variable to aggregate losses (house funds)
let houseFunds = 0;  
// In-memory transaction log array
let transactions = [];

// GET: Retrieve a player's off-chain balance
app.get('/api/user/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const balance = userBalances[wallet] || "0";
  res.json({ wallet, balance });
});

/*
  POST: Update a player's off-chain balance by a relative change.
  Expects { "balanceChange": <number> }.
  Prevents balance from going below 0.
  Negative changes are added to houseFunds.
  Each update is logged in the transaction log.
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
  if (change < 0) {
    houseFunds += Math.abs(change);
  }
  // Log the transaction
  transactions.push({
    address: wallet,
    amount: change.toString(),
    status: change < 0 ? "loss" : (change > 0 ? "win" : "neutral"),
    date: new Date()
  });
  res.json({ wallet, newBalance: userBalances[wallet] });
});

// GET: Return transaction logs
app.get('/api/transactions', (req, res) => {
  res.json({ transactions });
});

/*
  POST /api/player/reconcile
  Called when a player finishes their session.
  Expects:
    { "wallet": "<walletAddress>", "initialDeposit": <number>, "finalBalance": <number> }
  Calculates netChange = finalBalance - initialDeposit.
    • netChange > 0 means the player won extra tokens.
    • netChange < 0 means the player lost tokens.
  Then triggers on-chain settlement:
    • winBet() if netChange > 0
    • loseBet() if netChange < 0
  Returns the transaction receipt and a message.
*/
app.post('/api/player/reconcile', async (req, res) => {
  const { wallet, initialDeposit, finalBalance } = req.body;
  if (!wallet || initialDeposit === undefined || finalBalance === undefined) {
    return res.status(400).json({ error: "wallet, initialDeposit, and finalBalance are required" });
  }
  const normalizedWallet = wallet.toLowerCase();
  const netChange = parseFloat(finalBalance) - parseFloat(initialDeposit);
  let txResult = null;
  try {
    if (netChange > 0) {
      console.log(`winBet: Awarding net win of ${netChange} MET to ${normalizedWallet}`);
      txResult = await metContract.winBet(normalizedWallet, ethers.utils.parseUnits(netChange.toString(), 18));
    } else if (netChange < 0) {
      console.log(`loseBet: Deducting net loss of ${Math.abs(netChange)} MET from ${normalizedWallet}`);
      txResult = await metContract.loseBet(normalizedWallet, ethers.utils.parseUnits(Math.abs(netChange).toString(), 18));
    } else {
      return res.json({
        wallet: normalizedWallet,
        netChange,
        message: "No net change. Off-chain balance equals initial deposit."
      });
    }
    console.log("Awaiting on-chain transaction confirmation...");
    const receipt = await txResult.wait();
    // Log reconciliation transaction
    transactions.push({
      address: normalizedWallet,
      amount: netChange.toString(),
      status: netChange < 0 ? "net loss" : "net win",
      date: new Date(),
      txHash: receipt.transactionHash
    });
    res.json({
      wallet: normalizedWallet,
      initialDeposit,
      finalBalance,
      netChange,
      txHash: receipt.transactionHash,
      message: netChange < 0
        ? `Player lost ${Math.abs(netChange)} MET; on-chain deduction applied.`
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

/*
  GET /api/admin/house-funds 
  Returns the aggregated house funds.
  Protected by JWT.
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
  POST /api/admin/cashout-house 
  Resets houseFunds to 0.
  Protected by JWT.
  In production, this should trigger an on-chain transfer from the house wallet.
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

/* =====================================================
   Other Endpoints (Win Percentage, Admin Login, etc.)
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

// Admin login endpoint (returns a JWT token).
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
