// server.js

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const cors = require('cors');
const Web3 = require('web3');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.BSC_RPC_URL));
const contractABI = require('./abi/METToken.json');
const contractAddress = process.env.TOKEN_CONTRACT;
const metToken = new web3.eth.Contract(contractABI, contractAddress);

const houseWallet = process.env.HOUSE_WALLET;
const housePrivateKey = process.env.HOUSE_PRIVATE_KEY;

let playerBalances = {};
let transactionLog = [];

function logEvent(type, wallet, value) {
  const entry = { time: new Date().toISOString(), type, wallet, value };
  transactionLog.push(entry);
  fs.appendFileSync('logs/transactions.log', JSON.stringify(entry) + '\n');
}

app.post('/api/confirm-purchase', async (req, res) => {
  const { buyer, usdAmount } = req.body;
  if (!buyer || !usdAmount) return res.status(400).json({ error: 'Invalid input' });

  const amountWei = web3.utils.toWei(usdAmount.toString(), 'ether');

  try {
    const tx = metToken.methods.transfer(buyer, amountWei);
    const gas = await tx.estimateGas({ from: houseWallet });
    const data = tx.encodeABI();
    const nonce = await web3.eth.getTransactionCount(houseWallet);

    const signedTx = await web3.eth.accounts.signTransaction({
      to: contractAddress,
      data,
      gas,
      nonce,
      chainId: 56
    }, housePrivateKey);

    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    logEvent('Purchase', buyer, usdAmount);
    res.json({ success: true, txHash: receipt.transactionHash });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Token transfer failed' });
  }
});

app.get('/api/get-win-percentages', (req, res) => {
  res.json({ paid: 30, free: 50 });
});

app.get('/api/get-bnb-price', async (req, res) => {
  try {
    const coingecko = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
    const data = await coingecko.json();
    res.json({ bnbPrice: data.binancecoin.usd });
  } catch (e) {
    console.error('Error fetching BNB price', e);
    res.status(500).json({ error: 'Failed to fetch price' });
  }
});

// Hybrid Off-Chain Balance API
app.post('/api/balance', (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: 'No wallet provided' });
  res.json({ credits: playerBalances[wallet] || 0 });
});

app.post('/api/spin', (req, res) => {
  const { wallet, bet, result, winAmount } = req.body;
  if (!wallet || !bet || typeof winAmount !== 'number') {
    return res.status(400).json({ error: 'Invalid spin data' });
  }

  playerBalances[wallet] = (playerBalances[wallet] || 0) - bet + winAmount;
  logEvent('Spin', wallet, winAmount > 0 ? `Win ${winAmount}` : `Loss ${bet}`);
  res.json({ success: true, balance: playerBalances[wallet] });
});

app.post('/api/cashout', (req, res) => {
  const { wallet } = req.body;
  if (!wallet || !playerBalances[wallet]) {
    return res.status(400).json({ error: 'Nothing to cashout' });
  }

  const amount = playerBalances[wallet];
  playerBalances[wallet] = 0;
  logEvent('Cashout', wallet, amount);
  res.json({ success: true, amount });
});

app.post('/api/send-bonus', (req, res) => {
  const { wallet, amount } = req.body;
  if (!wallet || isNaN(amount)) return res.status(400).json({ error: 'Invalid bonus' });

  playerBalances[wallet] = (playerBalances[wallet] || 0) + parseFloat(amount);
  logEvent('Bonus', wallet, amount);
  res.json({ success: true, newBalance: playerBalances[wallet] });
});

app.get('/api/players', (req, res) => {
  const summary = Object.entries(playerBalances).map(([wallet, balance]) => ({
    wallet,
    balance
  }));
  res.json(summary);
});

app.get('/api/export-log', (req, res) => {
  const csv = 'Time,Type,Wallet,Value\n' + transactionLog.map(e => `${e.time},${e.type},${e.wallet},${e.value}`).join('\n');
  res.header('Content-Type', 'text/csv');
  res.attachment('transactions.csv');
  return res.send(csv);
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
