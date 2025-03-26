require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const axios = require('axios');
// ... any other imports

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(bodyParser.json());

// 1. Serve entire project folder as static
//    This allows you to reference files with "assets/...", "css/...", etc.
app.use(express.static(path.join(__dirname, '..')));

// 2. OPTIONAL: Serve index.html by default if you want root to open the free version
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
});

// In-memory storage for win percentage and transactions (example)
let winPercentage = parseInt(process.env.WIN_PERCENT) || 30;
let transactions = [];

// Example: GET/POST routes for your slot machine logic
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

// Contact form or other routes
app.post('/contact', async (req, res) => {
  // ...
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

