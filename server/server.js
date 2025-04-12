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

// Serve static files from views, public, and items
app.use(express.static(path.join(__dirname, '../views')));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/items', express.static(path.join(__dirname, '../items')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'index.html'));
});

/* =====================================================
   On-chain Settlement Setup
   ===================================================== */
// Set up ethers provider and house signer using your PRIVATE_KEY
const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC_URL);
const houseSigner = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Minimal ABI for deposit-based game: winBet and loseBet
const MET_ABI = [
  "function winBet(address player, uint256 amount) external",
  "function loseBet(address player, uint256 amount) external"
];
const MET_CONTRACT_ADDRESS = process.env.MET_CONTRACT_ADDRESS;
const metContract = new ethers.Contract(MET_CONTRACT_ADDRESS, MET_ABI, houseSigner);

/* =====================================================
   Off-chain Balance and Logging
   ===================================================== */
const userBalances = {}; // Off-chain virtual balances (should reflect locked deposits)
let houseFunds = 0;      // Aggregated losses
let transactions = [];   // In-memory log of transactions

// GET a player's off-chain balance
app.get('/api/user/:walletAddress', (req, res) => {
  const wallet = req.params.walletAddress.toLowerCase();
  const balance = userBalances[wallet] || "0";
  res.json({ wallet, balance });
});

// POST: Update off-chain balance (relative change)
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
  const logEntry = {
    address: wallet,
    amount: change.toString(),
    status: (change < 0) ? "loss" : (change > 0 ? "win" : "neutral"),
    date: new Date()
  };
  transactions.push(logEntry);
  console.log("Logged transaction:", logEntry);
  res.json({ wallet, newBalance: userBalances[wallet] });
});

// GET transaction logs
app.get('/api/transactions', (req, res) => {
  res.json({ transactions });
});

// GET download transactions as CSV; resets logs after successful download.
app.get('/api/download-transactions', (req, res) => {
  let csvContent = "Address,Amount MET,Status,Date,TxHash\n";
  transactions.forEach(tx => {
    csvContent += `${tx.address},${tx.amount},${tx.status},${tx.date.toISOString()},${tx.txHash || ""}\n`;
  });
  const filePath = path.join(__dirname, '../transactions.csv');
  fs.writeFileSync(filePath, csvContent);
  res.download(filePath, 'transactions.csv', (err) => {
    if (err) {
      console.error("Error downloading transactions:", err);
    } else {
      console.log("Transactions downloaded; resetting log.");
      transactions = [];
    }
    fs.unlinkSync(filePath);
  });
});

/*
  POST /api/player/reconcile
  Expects { "wallet": "<walletAddress>", "initialDeposit": <number>, "finalBalance": <number> }
  Calculates netChange = finalBalance - initialDeposit.
    If netChange > 0, calls winBet() on chain,
    If netChange < 0, calls loseBet() on chain.
*/
app.post('/api/player/reconcile', async (req, res) => {
  const { wallet, initialDeposit, finalBalance } = req.body;
  if (!wallet || initialDeposit === undefined || finalBalance === undefined) {
    return res.status(400).json({ error: "wallet, initialDeposit, and finalBalance are required" });
  }
  const normalizedWallet = wallet.toLowerCase();
  const netChange = parseFloat(finalBalance) - parseFloat(initialDeposit);
  console.log(`Reconciling ${normalizedWallet}: initial=${initialDeposit}, final=${finalBalance}, netChange=${netChange}`);
  let txResult = null;
  try {
    if (netChange > 0) {
      console.log(`winBet() for net win of ${netChange} MET to ${normalizedWallet}`);
      txResult = await metContract.winBet(normalizedWallet, ethers.utils.parseUnits(netChange.toString(), 18));
    } else if (netChange < 0) {
      console.log(`loseBet() for net loss of ${Math.abs(netChange)} MET from ${normalizedWallet}`);
      txResult = await metContract.loseBet(normalizedWallet, ethers.utils.parseUnits(Math.abs(netChange).toString(), 18));
    } else {
      return res.json({
        wallet: normalizedWallet,
        netChange,
        message: "No net change; no on-chain settlement necessary."
      });
    }
    console.log("Waiting for transaction confirmation...");
    const receipt = await txResult.wait();
    console.log("Transaction confirmed:", receipt.transactionHash);
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

// GET /api/admin/house-funds (protected)
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

// POST /api/admin/cashout-house (protected)
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

// Admin login endpoint (returns a JWT)
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
