const API_URL = 'https://slot-machine-a08c.onrender.com';

let web3;
let walletAddress = "";
let tokenContract;
let credits = 0;
let currentBet = 0;
let winPercentage = 30; // This value could also be used to scale payouts if desired

// The correct contract address for MET tokens
const tokenAddress = "0xb80b92Be7402E1e2D3189fff261D672D8104b322";
// Minimal ABI to fetch balance
const tokenABI = [
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "type": "function"
  }
];

// Symbols used for the reels (images in /assets/)
const symbols = [
  "seven.png",
  "coins1.png",
  "crown.png",
  "goldbar.png",
  "key.png",
  "chest.png"
];

// Payout multipliers for maximum consecutive matching symbols
// 3 in a row: x5, 4: x10, 5: x50, 6: x150
const multipliers = {
  3: 5,
  4: 10,
  5: 50,
  6: 150
};

document.addEventListener("DOMContentLoaded", async () => {
  // DOM Elements
  const spinBtn = document.getElementById("spinBtn");
  const betButtons = document.querySelectorAll(".bet");
  const reels = document.querySelectorAll(".reel img");
  const balanceDisplay = document.getElementById("metBalance");
  const totalCreditsDisplay = document.getElementById("totalCredits");
  const connectWalletBtn = document.getElementById("connectWallet");
  const cashOutBtn = document.getElementById("cashOutBtn");

  // Buy MET Section Elements
  const usdInput = document.getElementById("usdAmount");
  const bnbInput = document.getElementById("bnbAmount");
  const calculateBtn = document.getElementById("calculateMetBtn");
  const buyBtn = document.getElementById("buyNowBtn");
  const outputLabel = document.getElementById("metEstimate");

  // Initialize win percentage from backend (if needed)
  async function fetchWinPercentage() {
    try {
      const res = await fetch(`${API_URL}/api/get-win-percentages`);
      const data = await res.json();
      winPercentage = data.paid || 30;
    } catch (err) {
      console.error("Error fetching win percentage:", err);
    }
  }

  // Initialize Web3 and wallet connection
  async function initWallet() {
    if (window.ethereum) {
      web3 = new Web3(window.ethereum);
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        walletAddress = accounts[0];
        connectWalletBtn.textContent = walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4);
        tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
        await fetchBalance();
        spinBtn.disabled = false;
      } catch (err) {
        console.error("Wallet connection error:", err);
      }
    } else {
      alert("Please install MetaMask!");
    }
  }

  // Fetch off-chain MET balance from backend
  async function fetchBalance() {
    try {
      const res = await fetch(`${API_URL}/api/balance?wallet=${walletAddress}`);
      const data = await res.json();
      credits = parseFloat(data.credits || 0);
      updateBalanceUI();
    } catch (err) {
      console.error("Error fetching balance:", err);
    }
  }

  function updateBalanceUI() {
    balanceDisplay.textContent = `${credits.toFixed(2)} MET`;
    totalCreditsDisplay.textContent = `Credits: ${credits.toFixed(2)}`;
  }

  // Calculate maximum consecutive matching symbols (left-to-right)
  function maxConsecutive(arr) {
    let maxCount = 1, currentCount = 1;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] === arr[i - 1]) {
        currentCount++;
      } else {
        if (currentCount > maxCount) maxCount = currentCount;
        currentCount = 1;
      }
    }
    return Math.max(maxCount, currentCount);
  }

  // Spin reels function with animation and new payout logic
  async function spinReels() {
    if (!walletAddress || currentBet <= 0 || credits < currentBet) {
      alert("Connect your wallet and ensure sufficient credits.");
      return;
    }

    // Deduct bet
    credits -= currentBet;
    updateBalanceUI();

    const result = [];
    // Animate each reel and assign random symbol from the new set
    reels.forEach((reel, i) => {
      reel.classList.add("spinning");
      setTimeout(() => {
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        reel.src = `/assets/${symbol}`;
        reel.classList.remove("spinning");
        result[i] = symbol;
      }, i * 200);
    });

    // Wait for animations to complete
    setTimeout(async () => {
      // Determine maximum consecutive matching symbols
      const consecutiveCount = maxConsecutive(result);
      let winAmount = 0;
      if (consecutiveCount >= 3 && multipliers[consecutiveCount]) {
        winAmount = currentBet * multipliers[consecutiveCount];
        credits += winAmount;
        alert(`🎉 You win ${winAmount} MET! (${consecutiveCount} in a row)`);
        // Record win on backend
        await fetch(`${API_URL}/api/settle-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, credits: winAmount })
        });
      } else {
        // Record loss on backend
        await fetch(`${API_URL}/api/record-loss`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, amount: currentBet })
        });
      }
      updateBalanceUI();
      await fetchBalance();
    }, 1000);
  }

  // Buy MET logic with conversion
  async function calculateConversion() {
    const usdVal = parseFloat(usdInput.value);
    const bnbVal = parseFloat(bnbInput.value);

    try {
      const res = await fetch(`${API_URL}/api/get-bnb-price`);
      const { bnbPrice } = await res.json();

      let usdAmount = usdVal > 0 ? usdVal : bnbVal * bnbPrice;
      let bnbAmount = usdVal > 0 ? usdVal / bnbPrice : bnbVal;

      outputLabel.textContent = `Buy ${usdAmount.toFixed(2)} MET = ${bnbAmount.toFixed(4)} BNB = $${usdAmount.toFixed(2)}`;
      buyBtn.setAttribute("data-usd", usdAmount.toFixed(2));
      buyBtn.setAttribute("data-bnb", bnbAmount.toFixed(6));
    } catch (err) {
      console.error("Conversion error:", err);
      outputLabel.textContent = "Error fetching conversion rate.";
    }
  }

  async function confirmPurchase() {
    const usdAmount = parseFloat(buyBtn.getAttribute("data-usd"));
    const bnbAmount = buyBtn.getAttribute("data-bnb");
    if (!walletAddress || !bnbAmount) return;

    try {
      // Send BNB transaction from player to house wallet
      await web3.eth.sendTransaction({
        from: walletAddress,
        to: process.env.HOUSE_WALLET_ADDRESS,
        value: web3.utils.toWei(bnbAmount, "ether")
      });

      // Trigger backend to transfer MET tokens to buyer
      await fetch(`${API_URL}/api/confirm-purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyer: walletAddress, usdAmount })
      });

      alert("Transaction sent! Your MET tokens will arrive shortly.");
      await fetchBalance();
    } catch (err) {
      console.error("Purchase failed:", err);
      alert("Transaction failed.");
    }
  }

  // Event Listeners
  connectBtn.addEventListener("click", initWallet);
  spinBtn.addEventListener("click", spinReels);
  calculateBtn.addEventListener("click", calculateConversion);
  buyBtn.addEventListener("click", confirmPurchase);

  // Bet button event listener
  const betValues = [1, 5, 10, 50, 100, 1000];
  betButtons.forEach((btn, idx) => {
    btn.addEventListener("click", () => {
      currentBet = betValues[idx];
      console.log(`Current bet set to ${currentBet} MET`);
    });
  });

  // Initialize win percentage and balance on load
  await fetchWinPercentage();
  await initWallet();
});
