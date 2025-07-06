// server/server.js
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
    const fileName = route.endsWith('/') ? 'index.html' : route;
    app.get(route, (req, res) => res.sendFile(path.join(viewsPath, fileName)));
});

// --- API Endpoints, Admin, etc. ---
// (Your full API, admin, and contact endpoints would go here, updated for PostgreSQL)


// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    initializeDatabase();
});