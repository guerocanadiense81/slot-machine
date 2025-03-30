require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const Web3 = require("web3");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

// ✅ Environment variable validation
if (!process.env.PORT) throw new Error('Missing required env var: PORT');
if (!process.env.BSC_RPC_URL) throw new Error('Missing required env var: BSC_RPC_URL');
if (!process.env.MET_WALLET_ADDRESS) throw new Error('Missing required env var: MET_WALLET_ADDRESS');
if (!process.env.MET_CONTRACT_ADDRESS) throw new Error('Missing required env var: MET_CONTRACT_ADDRESS');
if (!process.env.HOUSE_WALLET_ADDRESS) throw new Error('Missing required env var: HOUSE_WALLET_ADDRESS');
if (!process.env.BNB_FEES_WALLET_ADDRESS) throw new Error('Missing required env var: BNB_FEES_WALLET_ADDRESS');
if (!process.env.ADMIN_USERNAME) throw new Error('Missing required env var: ADMIN_USERNAME');
if (!process.env.ADMIN_PASSWORD) throw new Error('Missing required env var: ADMIN_PASSWORD');
if (!process.env.JWT_SECRET) throw new Error('Missing required env var: JWT_SECRET');
if (!process.env.WIN_PERCENT) throw new Error('Missing required env var: WIN_PERCENT');
if (!process.env.WIN_PERCENT_FREE) throw new Error('Missing required env var: WIN_PERCENT_FREE');
if (!process.env.PRIVATE_KEY) throw new Error('Missing required env var: PRIVATE_KEY');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../views")));
app.use("/assets", express.static(path.join(__dirname, "../assets")));
app.use("/js", express.static(path.join(__dirname, "../js")));
app.use("/css", express.static(path.join(__dirname, "../css")));

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.BSC_RPC_URL));
const MET_ABI = require("../abi/METToken.json");
const contract = new web3.eth.Contract(MET_ABI, process.env.MET_CONTRACT_ADDRESS);

const balances = {}; // Hybrid off-chain balance tracker
const logsPath = path.join(__dirname, "logs");
const txLogPath = path.join(logsPath, "transactions.log");
if (!fs.existsSync(logsPath)) fs.mkdirSync(logsPath);

function logTransaction(message) {
  fs.appendFileSync(txLogPath, `[${new Date().toISOString()}] ${message}\n`);
}

app.post("/api/confirm-purchase", async (req, res) => {
  const { buyer, usdAmount } = req.body;
  if (!buyer || !usdAmount) return res.status(400).json({ success: false });

  const amount = web3.utils.toWei(usdAmount.toString(), "ether");
  const tx = {
    to: process.env.MET_CONTRACT_ADDRESS,
    gas: 150000,
    data: contract.methods.purchaseTokens(buyer, amount).encodeABI(),
  };

  try {
    const signed = await web3.eth.accounts.signTransaction(tx, process.env.PRIVATE_KEY);
    const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
    balances[buyer] = (balances[buyer] || 0) + parseFloat(usdAmount);
    logTransaction(`MET sent to ${buyer} | Amount: ${usdAmount} | TX: ${receipt.transactionHash}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Confirm purchase error:", err);
    res.status(500).json({ success: false });
  }
});

app.post("/api/spin", (req, res) => {
  const { wallet, bet } = req.body;
  if (!wallet || !bet || balances[wallet] < bet) return res.json({ success: false });

  balances[wallet] -= bet;
  logTransaction(`SPIN - ${wallet} lost ${bet} credits`);
  res.json({ success: true });
});

app.post("/api/settle-session", (req, res) => {
  const { wallet, amount } = req.body;
  if (!wallet || !amount) return res.status(400).json({ success: false });

  balances[wallet] = (balances[wallet] || 0) + amount;
  logTransaction(`SETTLE - ${wallet} wins ${amount} credits`);
  res.json({ success: true });
});

app.post("/api/cashout", async (req, res) => {
  const { wallet } = req.body;
  const amount = balances[wallet] || 0;
  if (!wallet || amount <= 0) return res.json({ success: false });

  const weiAmount = web3.utils.toWei(amount.toString(), "ether");

  const tx = {
    to: wallet,
    gas: 150000,
    data: contract.methods.purchaseTokens(wallet, weiAmount).encodeABI(),
  };

  try {
    const signed = await web3.eth.accounts.signTransaction(tx, process.env.PRIVATE_KEY);
    const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
    balances[wallet] = 0;
    logTransaction(`CASHOUT - ${wallet} received ${amount} MET | TX: ${receipt.transactionHash}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Cashout failed:", err);
    res.status(500).json({ success: false });
  }
});

app.get("/api/balance/:wallet", (req, res) => {
  const wallet = req.params.wallet;
  res.json({ balance: balances[wallet] || 0 });
});

app.get("/api/export-balances", (req, res) => {
  let csv = "Wallet,Credit\n";
  for (const [wallet, credit] of Object.entries(balances)) {
    csv += `${wallet},${credit}\n`;
  }
  res.header("Content-Type", "text/csv");
  res.attachment("balances.csv");
  res.send(csv);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
