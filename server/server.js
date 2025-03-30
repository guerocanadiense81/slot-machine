require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { Web3 } = require("web3");
const TelegramBot = require("node-telegram-bot-api");
const winston = require("winston");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../views")));

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.BSC_RPC_URL));
const tokenABI = require("../abi/METToken.json");
const contract = new web3.eth.Contract(tokenABI, process.env.MET_CONTRACT_ADDRESS);

// Logger
const logger = winston.createLogger({
  transports: [new winston.transports.File({ filename: "logs/transactions.log" })],
  format: winston.format.combine(winston.format.timestamp(), winston.format.json())
});

// Telegram
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

// Off-chain balance store
const balances = {}; // { walletAddress: number }

// GET: BNB Price
app.get("/api/get-bnb-price", async (req, res) => {
  try {
    const price = await contract.methods.getLatestBNBPrice().call();
    res.json({ bnbPrice: parseFloat(price) / 1e8 });
  } catch (err) {
    logger.error("BNB Price Fetch Error", { error: err.message });
    res.status(500).json({ error: "BNB price error" });
  }
});

// GET: Balance
app.get("/api/balance", (req, res) => {
  const wallet = req.query.wallet;
  res.json({ credits: balances[wallet] || 0 });
});

// POST: Confirm Purchase (After BNB is sent)
app.post("/api/confirm-purchase", async (req, res) => {
  const { buyer, usdAmount } = req.body;
  if (!buyer || !usdAmount) return res.status(400).json({ error: "Missing buyer or amount" });

  try {
    const amount = web3.utils.toWei(usdAmount.toString(), "ether");
    const tx = contract.methods.purchaseTokens(buyer, amount);
    const signed = await web3.eth.accounts.signTransaction(
      {
        to: process.env.MET_CONTRACT_ADDRESS,
        data: tx.encodeABI(),
        gas: 300000,
      },
      process.env.PRIVATE_KEY
    );
    const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);

    // Credit off-chain balance
    balances[buyer] = (balances[buyer] || 0) + parseFloat(usdAmount);

    logger.info("Confirm Purchase", { buyer, usdAmount, tx: receipt.transactionHash });
    res.json({ success: true, tx: receipt.transactionHash });
  } catch (err) {
    logger.error("Confirm Purchase Error", { error: err.message });
    res.status(500).json({ error: "Confirm purchase failed" });
  }
});

// POST: Spin
app.post("/api/spin", (req, res) => {
  const { wallet, bet, result, wonAmount } = req.body;

  if (!wallet || !bet || !result || isNaN(wonAmount)) {
    return res.status(400).json({ error: "Invalid spin request" });
  }

  balances[wallet] = (balances[wallet] || 0) - bet + wonAmount;

  logger.info("Spin", { wallet, bet, result, wonAmount });
  res.json({ newBalance: balances[wallet] });
});

// POST: Cash Out
app.post("/api/cashout", async (req, res) => {
  const { wallet } = req.body;
  const payout = balances[wallet] || 0;

  if (!wallet || payout <= 0) {
    return res.status(400).json({ error: "Invalid cashout request" });
  }

  try {
    const amount = web3.utils.toWei(payout.toString(), "ether");
    const tx = contract.methods.winBet(wallet, amount);
    const signed = await web3.eth.accounts.signTransaction(
      {
        to: process.env.MET_CONTRACT_ADDRESS,
        data: tx.encodeABI(),
        gas: 300000,
      },
      process.env.PRIVATE_KEY
    );
    const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);

    balances[wallet] = 0;

    logger.info("Cashout", { wallet, payout, tx: receipt.transactionHash });

    if (payout >= 500) {
      await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, `🎉 BIG WIN CASHOUT\nWallet: ${wallet}\nAmount: ${payout} MET`);
    }

    res.json({ success: true, tx: receipt.transactionHash });
  } catch (err) {
    logger.error("Cashout Error", { error: err.message });
    res.status(500).json({ error: "Cashout failed" });
  }
});

// Admin Login
app.post("/api/admin-login", (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(403).json({ error: "Unauthorized" });
  }
});

// Fallback
app.get("*", (req, res) => res.send("Slot Machine Hybrid Backend Running"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
