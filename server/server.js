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
const SECRET_KEY = process.env.JWT_SECRET || 'defaultSecret';

// Enable CORS and JSON body parsing
app.use(cors());
app.use(bodyParser.json());

// Serve the entire project root so that references like "/assets/..." work
app.use(express.static(path.join(__dirname, '..')));

// Serve HTML files from /views explicitly
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

// In-memory storage for win percentage and transactions
let winPercentage = parseInt(process.env.WIN_PERCENT) || 30;
let transactions = [];

// -------------------------
// API ENDPOINTS
// -------------------------

// Get win percentage
app.get('/api/get-win-percentage', (req, res) => {
  res.json({ percentage: winPercentage });
});

// Set win percentage
app.post('/api/set-win-percentage', (req, res) => {
  const { percentage } = req.body;
  if (typeof percentage === 'number' && percentage >= 0 && percentage <= 100) {
    winPercentage = percentage;
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid percentage value' });
  }
});

// Record a transaction (for simulation)
app.post('/api/record-transaction', (req, res) => {
  const { address, amount, status } = req.body;
  transactions.push({ address, amount, status, date: new Date() });
  res.json({ success: true });
});

// Get transaction log
app.get('/api/transactions', (req, res) => {
  res.json({ transactions });
});

// Download transactions as CSV
app.get('/api/download-transactions', (req, res) => {
  let csvContent = "Address,Amount MET,Status,Date\n";
  transactions.forEach(tx => {
    csvContent += `${tx.address},${tx.amount},${tx.status},${tx.date}\n`;
  });
  const filePath = path.join(__dirname, 'transactions.csv');
  fs.writeFileSync(filePath, csvContent);
  res.download(filePath, 'transactions.csv', () => fs.unlinkSync(filePath));
});

// Admin login endpoint
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "2h" });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
});

// New Endpoint: Buy MET using BNB
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

app.post('/api/buy-met', async (req, res) => {
  const { walletAddress, bnbAmount } = req.body;
  if (!walletAddress || !bnbAmount) {
    return res.status(400).json({ error: "Missing wallet address or BNB amount" });
  }

  try {
    // Get current BNB price in USD from CoinGecko
    const bnbPriceUSD = await getBNBPriceUSD();
    // Calculate MET tokens: 1 MET = $1 USD
    const metAmount = bnbAmount * bnbPriceUSD;
    
    // Here, you would interact with your smart contract to transfer MET tokens.
    // For simulation, we log the transaction and record it.
    console.log(`Player ${walletAddress} buys ${metAmount} MET for ${bnbAmount} BNB (BNB Price: $${bnbPriceUSD})`);
    
    // Record transaction (simulate successful purchase)
    transactions.push({ address: walletAddress, amount: metAmount, status: "bought", date: new Date() });
    
    res.json({ success: true, metAmount });
  } catch (error) {
    res.status(500).json({ error: "Failed to process MET purchase" });
  }
});

// Contact Form endpoint (sends message to Telegram)
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
