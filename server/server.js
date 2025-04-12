// server/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const jwt = require('jsonwebtoken');
// Require ethers for on-chain interactions
const { ethers } = require("ethers");

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || "defaultsecret";

app.use(cors());
app.use(bodyParser.json());

// Serve static files from sibling directories (since server.js is in /server)
app.use(express.static(path.join(__dirname, '../views')));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/items', express.static(path.join(__dirname, '../items')));

// Home route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'index.html'));
});

/* --------------------------------------------------
   On-chain Settlement Setup
   -------------------------------------------------- */
// Set up an ethers provider and a signer for the house wallet using environment variables.
const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC_URL);
const houseSigner = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Minimal ABI including winBet and loseBet functions.
const MET_ABI = [
  "function winBet(address player, uint256 amount) external",
  "function loseBet(address player, uint256 amount) external"
];
const metContract = new ethers.Contract(process.env.MET_CONTRACT_ADDRESS, MET_ABI, houseSigner);

/* --------------------------------------------------
   Off-chain Virtual Credit Endpoints & Transaction Logging
   -------------------------------------------------- */
// In-memory store for individual user balances (keyed by wallet address)
const userBalances = {};
// Global variable to aggregate losses (house funds)
let houseFunds = 0;
// In-memory transaction log
let transactions = [];

// GET user's off-chain balance
app.get('/api/user/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const balance = userBalances[wallet] || "0";
  res.json({ wallet, balance });
});

/*
  POST /api/user/:walletAddress 
  Expects: { "balanceChange": <number> }
  Updates the user's virtual balance (ensuring it does not fall below 0),
  and if the balanceChange is negative, adds the absolute value to houseFunds.
  Also logs the transaction.
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
    change = -currentBalance;
    newBalance = 0;
  }
  userBalances[wallet] = newBalance.toString();
  if (change < 0) {
    houseFunds += Math.abs(change);
  }
  // Log transaction
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
  Expects: { "wallet": "<walletAddress>", "initialDeposit": <number>, "finalBalance": <number> }
  Calculates netChange = finalBalance - initialDeposit.
  Then, triggers an on-chain transfer:
    - If netChange > 0, call winBet() to send tokens from house wallet to player.
    - If netChange < 0, call loseBet() to transfer tokens from player's wallet to house wallet.
  Returns transaction details.
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
      // Player wins: transfer tokens from the house wallet to the player's wallet.
      console.log(`Initiating winBet for ${normalizedWallet} amount: ${netChange}`);
      txResult = await metContract.winBet(normalizedWallet, ethers.utils.parseUnits(netChange.toString(), 18));
    } else if (netChange < 0) {
      // Player loses: transfer tokens from the player's wallet to the house wallet.
      // Note: For loseBet, the player must have sufficient on-chain balance.
      console.log(`Initiating loseBet for ${normalizedWallet} amount: ${Math.abs(netChange)}`);
      txResult = await metContract.loseBet(normalizedWallet, ethers.utils.parseUnits(Math.abs(netChange).toString(), 18));
    } else {
      // No net change, no on-chain action.
      return res.json({
        wallet: normalizedWallet,
        netChange,
        message: "No net change, no on-chain settlement necessary."
      });
    }
    console.log("Waiting for transaction confirmation...");
    const receipt = await txResult.wait();
    // Log the reconciliation transaction.
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
        ? `Player lost ${Math.abs(netChange)} MET; on-chain tokens deducted from player and sent to house wallet.`
        : `Player won ${netChange} MET; on-chain tokens transferred from house wallet to player.`
    });
  } catch (error) {
    console.error("On-chain settlement failed:", error);
    res.status(500).json({ error: "On-chain settlement failed", details: error.message });
  }
});

/*
  GET /api/admin/house-funds 
  Protected endpoint: returns aggregated houseFunds.
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
  Protected endpoint: resets houseFunds to 0 and, in production, would trigger an on-chain transfer.
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
   Other Endpoints (Win Percentage, Transactions, Admin Login, etc.)
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

// Admin login endpoint: returns a JWT token for the admin.
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "2h" });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
});

// (You can add additional endpoints such as for transaction logs if desired)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
