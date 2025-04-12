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
// Serve HTML pages from the "views" folder
app.use(express.static(path.join(__dirname, 'views')));
// Serve static assets (JS, CSS) from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));
// Serve images and other assets from the "items" folder under the "/items" URL
app.use('/items', express.static(path.join(__dirname, 'items')));

// In-memory storage for win percentage and transactions
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
  const filePath = path.join(__dirname, 'transactions.csv');
  fs.writeFileSync(filePath, csvContent);
  res.download(filePath, 'transactions.csv', () => fs.unlinkSync(filePath));
});

app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "2h" });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
});

app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: "All fields required" });
  
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
