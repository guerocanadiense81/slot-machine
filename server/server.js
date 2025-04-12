// server/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const jwt = require('jsonwebtoken');
// For on-chain interactions
const { ethers } = require("ethers");

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || "defaultsecret";

app.use(cors());
app.use(bodyParser.json());

// Serve static files from views, public, and items (using "../" because server.js is in /server)
app.use(express.static(path.join(__dirname, '../views')));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/items', express.static(path.join(__dirname, '../items')));

// Home route serving index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'index.html'));
});

/* =====================================================
   On-chain Settlement Setup via ethers.js
   ===================================================== */

// Create a provider and a signer (house wallet) using the BSC_RPC_URL and PRIVATE_KEY.
const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC_URL);
const houseSigner = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Minimal ABI: we assume your MET token contract provides winBet and loseBet methods.
const MET_ABI = [
  "function winBet(address player, uint256 amount) external",
  "function loseBet(address player, uint256 amount) external"
];
const MET_CONTRACT_ADDRESS = process.env.MET_CONTRACT_ADDRESS;
const metContract = new ethers.Contract(MET_CONTRACT_ADDRESS, MET_ABI, houseSigner);

/* =====================================================
   Off-chain Virtual Credit Endpoints & Transaction Logging
   ===================================================== */

// In-memory store for individual user balances (keyed by wallet address)
const userBalances = {};
// Global variable to accumulate losses (i.e. funds for the house)
let houseFunds = 0;
// In-memory transaction log (an array of transaction objects)
let transactions = [];

// GET a user's off-chain balance
app.get('/api/user/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const balance = userBalances[wallet] || "0";
  res.json({ wallet, balance });
});

/*
  POST /api/user/:walletAddress 
  Expects JSON: { "balanceChange": <number> }
  Updates the player's off-chain balance relative to the current balance.
  If the balance would drop below 0, it is set to 0.
  Negative changes (losses) are added to houseFunds.
  A transaction log is recorded.
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
  // Record transaction log entry
  transactions.push({
    address: wallet,
    amount: change.toString(),
    status: (change < 0) ? "loss" : (change > 0 ? "win" : "neutral"),
    date: new Date()
  });
  res.json({ wallet, newBalance: userBalances[wallet] });
});

// GET transaction logs
app.get('/api/transactions', (req, res) => {
  res.json({ transactions });
});

/*
  POST /api/player/reconcile 
  Reconciles a player's session by calculating:
    netChange = finalBalance - initialDeposit
  Then triggers on-chain settlement:
    - If netChange > 0, calls winBet() (transfer MET from house wallet to player)
    - If netChange < 0, calls loseBet() (transfer MET from player's wallet to house wallet)
  For demonstration, on-chain transfers are simulated.
  Expects JSON: { "wallet": "<walletAddress>", "initialDeposit": <number>, "finalBalance": <number> }
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
      console.log(`winBet: Transferring ${netChange} MET from house wallet to ${normalizedWallet}`);
      txResult = await metContract.winBet(normalizedWallet, ethers.utils.parseUnits(netChange.toString(), 18));
    } else if (netChange < 0) {
      console.log(`loseBet: Transferring ${Math.abs(netChange)} MET from ${normalizedWallet} to house wallet`);
      txResult = await metContract.loseBet(normalizedWallet, ethers.utils.parseUnits(Math.abs(netChange).toString(), 18));
    } else {
      return res.json({
        wallet: normalizedWallet,
        netChange,
        message: "No net change, no on-chain settlement necessary."
      });
    }
    console.log("Awaiting on-chain confirmation...");
    const receipt = await txResult.wait();
    // Log reconciliation transaction.
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
        ? `Player lost ${Math.abs(netChange)} MET; on-chain deducted from player and sent to house wallet.`
        : `Player won ${netChange} MET; on-chain transferred from house wallet to player.`
    });
  } catch (error) {
    console.error("On-chain settlement failed:", error);
    res.status(500).json({ error: "On-chain settlement failed", details: error.message });
  }
});

/* --------------------------------------------------
   Admin Endpoints
   -------------------------------------------------- */

/*
  GET /api/admin/house-funds
  Protected by JWT; returns aggregated houseFunds.
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
  Protected by JWT; resets houseFunds to 0.
  In production, this would trigger an on-chain transfer from the house wallet.
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
   Other Endpoints (Win Percentage, Admin Login, etc.)
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

// Admin login endpoint: returns a JWT token.
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "2h" });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
});

// (Optional: additional endpoints such as for recording transactions can be added here.)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
