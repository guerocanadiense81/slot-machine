// server/server.js with PostgreSQL Integration
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const { ethers } = require("ethers");
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.JWT_SECRET || "defaultsecret";

// --- Database Connection ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- Database Initialization ---
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS balances (
                wallet_address VARCHAR(42) PRIMARY KEY,
                deposit NUMERIC(36, 18) DEFAULT 0,
                net_play NUMERIC(36, 18) DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS house_funds ( id INT PRIMARY KEY, amount NUMERIC(36, 18) DEFAULT 0 );
            CREATE TABLE IF NOT EXISTS transactions ( id SERIAL PRIMARY KEY, wallet_address VARCHAR(42), type VARCHAR(20), amount NUMERIC(36, 18), tx_hash VARCHAR(66), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );
        `);
        await client.query(`INSERT INTO house_funds (id, amount) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;`);
        console.log("Database initialized successfully.");
    } catch (err) {
        console.error("Error initializing database:", err);
    } finally {
        client.release();
    }
}

// --- Middleware ---
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/items', express.static(path.join(__dirname, '../items')));

// --- HTML Routes ---
const viewsPath = path.join(__dirname, '../views');
['/', '/index.html', '/paid-game.html', '/contact.html', '/instructions.html', '/admin.html', '/admin-login.html'].forEach(route => {
    app.get(route, (req, res) => res.sendFile(path.join(viewsPath, route.endsWith('/') ? 'index.html' : route)));
});

// --- Auth Middleware for Admin ---
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split(" ")[1];
    try {
        jwt.verify(token, SECRET_KEY);
        next();
    } catch (error) {
        return res.status(401).json({ error: "Invalid token" });
    }
};

// --- API Endpoints ---
app.get('/api/user/:walletAddress', async (req, res) => { /* ... existing code ... */ });
app.post('/api/balance-change/:walletAddress', async (req, res) => { /* ... existing code ... */ });
// (Add other user-facing endpoints like deposit and reconcile here)

// --- Admin Endpoints ---
app.post("/admin/login", (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "2h" });
        res.json({ success: true, token });
    } else {
        res.status(401).json({ success: false, message: "Unauthorized" });
    }
});

app.get('/api/admin/house-funds', authenticateAdmin, async (req, res) => {
    const result = await pool.query('SELECT amount FROM house_funds WHERE id = 1');
    res.json({ houseFunds: result.rows[0].amount || "0" });
});

// --- Contact Form Endpoint ---
app.post('/contact', (req, res) => {
    const { name, email, message } = req.body;
    // In a real application, you would email this or save it.
    // For this project, we will just log it to the server console.
    console.log('----- Contact Form Submission -----');
    console.log(`Name: ${name}`);
    console.log(`Email: ${email}`);
    console.log(`Message: ${message}`);
    console.log('---------------------------------');
    res.json({ success: true });
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    initializeDatabase();
});
