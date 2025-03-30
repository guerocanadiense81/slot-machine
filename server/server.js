require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const winston = require("winston");
const TelegramBot = require("node-telegram-bot-api");
const { Web3 } = require("web3");
const tokenABI = require("../abi/METToken.json");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../")));

// Logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.File({ filename: "logs/transactions.log" })],
});

// Telegram Bot
const telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

// Web3
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.BSC_RPC_URL));
const contract = new web3.eth.Contract(tokenABI, process.env.MET_CONTRACT_ADDRESS);

// Globals
let paidWinPercent = parseInt(process.env.WIN_PERCENT) || 30;
let freeWinPercent = 30;

// Routes

app.get("/api/get-bnb-price", async (req, res) => {
  try {
    const price = await contract.methods.getLatestBNBPrice().call();
    res.json({ bnbPrice: parseFloat(price) / 1e8 });
  } catch (err) {
    logger.error("BNB Price Fetch Error", { error: err.message });
    res.status(500).json({ error: "Failed to fetch BNB price." });
  }
});

app.post("/api/confirm-purchase", async (req, res) => {
  const { walletAddress, usdAmount } = req.body;

  if (!walletAddress || !usdAmount) {
    return res.status(400).json({ error: "Missing wallet or amount." });
  }

  const tokenAmount = web3.utils.toWei(usdAmount.toString(), "ether");

  try {
    const tx = contract.methods.purchaseTokens(walletAddress, tokenAmount);
    const gas = await tx.estimateGas({ from: process.env.HOUSE_WALLET });
    const data = tx.encodeABI();

    const signed = await web3.eth.accounts.signTransaction(
      {
        to: process.env.MET_CONTRACT_ADDRESS,
        data,
        gas,
      },
      process.env.PRIVATE_KEY
    );

    const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);

    logger.info("MET Purchased via confirm-purchase", {
      walletAddress,
      usdAmount,
      txHash: receipt.transactionHash,
    });

    res.json({ success: true, txHash: receipt.transactionHash });
  } catch (err) {
    logger.error("Confirm Purchase Error", { error: err.message });
    res.status(500).json({ error: "Failed to confirm purchase." });
  }
});

app.post("/api/settle-session", async (req, res) => {
  const { walletAddress, credits } = req.body;
  const payout = parseFloat(credits);

  if (!walletAddress || isNaN(payout) || payout <= 0) {
    return res.status(400).json({ error: "Invalid session data." });
  }

  const amount = web3.utils.toWei(payout.toString(), "ether");

  try {
    const tx = contract.methods.winBet(walletAddress, amount);
    const signed = await web3.eth.accounts.signTransaction(
      {
        to: process.env.MET_CONTRACT_ADDRESS,
        data: tx.encodeABI(),
        gas: 200000,
      },
      process.env.PRIVATE_KEY
    );

    const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);

    logger.info("Session Settled (win)", {
      wallet: walletAddress,
      amount: payout,
      tx: receipt.transactionHash,
    });

    if (payout >= 500) {
      await telegramBot.sendMessage(
        process.env.TELEGRAM_CHAT_ID,
        `🎉 BIG WIN!
User: ${walletAddress}
Winnings: ${payout} MET
Tx: https://bscscan.com/tx/${receipt.transactionHash}`
      );
    }

    res.json({ success: true, txHash: receipt.transactionHash });
  } catch (err) {
    logger.error("WinBet Error", { error: err.message });
    res.status(500).json({ error: "Cash out failed." });
  }
});

app.post("/api/record-loss", async (req, res) => {
  const { walletAddress, amount } = req.body;

  if (!walletAddress || isNaN(amount)) {
    return res.status(400).json({ error: "Missing wallet or amount." });
  }

  const lossAmount = web3.utils.toWei(amount.toString(), "ether");

  try {
    const tx = contract.methods.loseBet(walletAddress, lossAmount);
    const signed = await web3.eth.accounts.signTransaction(
      {
        to: process.env.MET_CONTRACT_ADDRESS,
        data: tx.encodeABI(),
        gas: 200000,
      },
      process.env.PRIVATE_KEY
    );
    const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);

    logger.info("Session Settled (loss)", {
      wallet: walletAddress,
      amount,
      tx: receipt.transactionHash,
    });

    res.json({ success: true, txHash: receipt.transactionHash });
  } catch (error) {
    logger.error("LoseBet Error", { error: error.message });
    res.status(500).json({ error: "Loss record failed." });
  }
});

app.listen(process.env.PORT || 5000, () => {
  console.log("Server is running");
});
