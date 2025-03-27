require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const Web3 = require('web3');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || 'defaultSecret';

// Initialize Web3 using BSC RPC and add PRIVATE_KEY to the wallet
const web3 = new Web3(process.env.BSC_RPC_URL);
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);

// Minimal MET Token ABI (update with your full ABI as needed)
const metTokenABI = [
  {
    "constant": false,
    "inputs": [
      { "name": "buyer", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "purchaseTokens",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "player", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "loseBet",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      { "name": "player", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "winBet",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  }
];
const metTokenAddress = process.env.MET_CONTRACT_ADDRESS;
const metTokenContract = new web3.eth.Contract(metTokenABI, metTokenAddress);

app.use(cors());
app.use(bodyParser.json());

// Serve static files from project root (absolute paths like /css/style.css work)
app.use(express.static(path.join(__dirname, '..')));

// Explicitly serve HTML files from /views
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
});
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
});
app.get('/paid.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'paid.html'));
});
app.get('/about.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'about.html'));
});
app.get('/instructions.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'instructions.html'));
});
app.get('/contact.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'contact.html'));
});
app.get('/admin-login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'admin-login.html'));
});
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'admin.html'));
});

// In-memory storage for win percentage, transaction logs, and paused state
let winPercentage = parseInt(process.env.WIN_PERCENT) || 30;
let transactions = [];
let paused = false; // indicates if the game is paused

// API endpoint: Get win percentage
app.get('/api/get-win-percentage', (req, res) => {
  res.json({ percentage: winPercentage });
});

// API endpoint: Set win percentage
app.post('/api/set-win-percentage', (req, res) => {
  const { percentage } = req.body;
  if (typeof percentage === 'number' && percentage >= 0 && percentage <= 100) {
    winPercentage = percentage;
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid percentage value' });
  }
});

// API endpoint: Get paused state
app.get('/api/get-paused', (req, res) => {
  res.json({ paused });
});

// API endpoint: Pause game
app.post('/api/pause', (req, res) => {
  paused = true;
  res.json({ success: true, paused });
});

// API endpoint: Unpause game
app.post('/api/unpause', (req, res) => {
  paused = false;
  res.json({ success: true, paused });
});

// API endpoint: Record transaction
app.post('/api/record-transaction', (req, res) => {
  const { address, amount, status } = req.body;
  transactions.push({ address, amount, status, date: new Date() });
  res.json({ success: true });
});

// API endpoint: Get transactions
app.get('/api/transactions', (req, res) => {
  res.json({ transactions });
});

// API endpoint: Download transactions as CSV
app.get('/api/download-transactions', (req, res) => {
  let csvContent = "Address,Amount MET,Status,Date\n";
  transactions.forEach(tx => {
    csvContent += `${tx.address},${tx.amount},${tx.status},${tx.date}\n`;
  });
  const filePath = path.join(__dirname, 'transactions.csv');
  fs.writeFileSync(filePath, csvContent);
  res.download(filePath, 'transactions.csv', () => fs.unlinkSync(filePath));
});

// Admin Login Endpoint
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "2h" });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
});

// Settlement endpoint: Called via sendBeacon or Cash Out
app.post('/api/settle-session', (req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', async () => {
    try {
      const { walletAddress, credits } = JSON.parse(body);
      console.log(`Settling session for ${walletAddress} with final balance: ${credits}`);
      
      // If credits is 0, then no settlement is needed.
      if (credits === 0) {
        console.log("No settlement needed (credits 0).");
        return res.json({ success: true, message: "No settlement needed (credits 0)" });
      }
      
      // Assume a fee of 2% on winnings (only if credits > 0)
      const feePercentage = 2;
      
      if (credits > 0) {
        // Calculate fee in MET tokens (1 MET = 1 USD)
        let feeInMET = (credits * feePercentage) / 100;
        let netWin = credits - feeInMET;
        const netWinWei = web3.utils.toWei(netWin.toString(), 'ether');

        // Call winBet on the contract to transfer net winnings from house wallet to player
        const winTx = metTokenContract.methods.winBet(walletAddress, netWinWei);
        const gasWin = await winTx.estimateGas({ from: account.address });
        const gasPriceWin = await web3.eth.getGasPrice();
        const dataWin = winTx.encodeABI();
        const txDataWin = {
          from: account.address,
          to: metTokenAddress,
          data: dataWin,
          gas: gasWin,
          gasPrice: gasPriceWin
        };
        const winReceipt = await web3.eth.sendTransaction(txDataWin);
        console.log("winBet receipt:", winReceipt);

        // Convert fee from MET (USD equivalent) to BNB using current BNB price
        const bnbPriceUSD = await getBNBPriceUSD();
        if (!bnbPriceUSD) {
          throw new Error("Failed to fetch BNB price for fee conversion");
        }
        let feeInBNB = feeInMET / bnbPriceUSD;
        const feeValue = web3.utils.toWei(feeInBNB.toString(), 'ether');
        const feeTx = await web3.eth.sendTransaction({
          from: account.address,
          to: process.env.BNB_FEES_WALLET_ADDRESS,
          value: feeValue
        });
        console.log("Fee transaction receipt:", feeTx);
      } else if (credits < 0) {
        // Player lost: convert loss amount to Wei
        let loss = Math.abs(credits);
        const lossWei = web3.utils.toWei(loss.toString(), 'ether');
        const loseTx = metTokenContract.methods.loseBet(walletAddress, lossWei);
        const gasLose = await loseTx.estimateGas({ from: account.address });
        const gasPriceLose = await web3.eth.getGasPrice();
        const dataLose = loseTx.encodeABI();
        const txDataLose = {
          from: account.address,
          to: metTokenAddress,
          data: dataLose,
          gas: gasLose,
          gasPrice: gasPriceLose
        };
        const loseReceipt = await web3.eth.sendTransaction(txDataLose);
        console.log("loseBet receipt:", loseReceipt);
      } else {
        console.log("No settlement needed.");
      }
      
      // Record settlement transaction (simulation)
      transactions.push({
        address: walletAddress,
        amount: credits,
        status: "settled",
        date: new Date()
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error during settlement:", error);
      res.status(500).json({ error: "Settlement failed" });
    }
  });
});

// Endpoint to fetch BNB price in USD using CoinGecko API
async function getBNBPriceUSD() {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: 'binancecoin',
        vs_currencies: 'usd'
      }
    });
    return response.data.binancecoin.usd;
  } catch (error) {
    console.error("Error fetching BNB price:", error);
    throw error;
  }
}

// Endpoint to buy MET tokens using BNB (1 MET = 1 USD conversion)
app.post('/api/buy-met', async (req, res) => {
  const { walletAddress, bnbAmount } = req.body;
  if (!walletAddress || !bnbAmount) {
    return res.status(400).json({ error: "Missing wallet address or BNB amount" });
  }

  try {
    const bnbPriceUSD = await getBNBPriceUSD();
    const metAmount = bnbAmount * bnbPriceUSD;  // 1 MET = 1 USD conversion
    const metAmountWei = web3.utils.toWei(metAmount.toString(), 'ether');

    // Prepare transaction to call purchaseTokens(buyer, amount)
    const tx = metTokenContract.methods.purchaseTokens(walletAddress, metAmountWei);
    const gas = await tx.estimateGas({ from: account.address });
    const gasPrice = await web3.eth.getGasPrice();
    const data = tx.encodeABI();
    const txData = {
      from: account.address,
      to: metTokenAddress,
      data,
      gas,
      gasPrice
    };

    const receipt = await web3.eth.sendTransaction(txData);
    console.log("Purchase transaction receipt:", receipt);
    
    // Record the purchase transaction in our log (simulation)
    transactions.push({
      address: walletAddress,
      amount: metAmount,
      status: "bought",
      date: new Date()
    });
    
    res.json({ success: true, metAmount, txHash: receipt.transactionHash });
  } catch (error) {
    console.error("Error processing MET purchase:", error);
    res.status(500).json({ error: "Failed to process MET purchase" });
  }
});

// Contact Form Endpoint (sends message to Telegram)
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message)
    return res.status(400).json({ error: "All fields required" });
  
  const telegramUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const text = `New Contact Submission:\nName: ${name}\nEmail: ${email}\nMessage: ${message}`;
  
  try {
    await axios.post(telegramUrl, { chat_id: process.env.TELEGRAM_CHAT_ID, text });
    res.json({ success: true, message: "Message sent successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
