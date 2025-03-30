const API_URL = 'https://slot-machine-a08c.onrender.com';

let web3, walletAddress, tokenContract;
let currentBet = 0, credits = 0;

const tokenAddress = "0xb80b92Be7402E1e2D3189fff261D672D8104b322"; // Correct contract address
const tokenABI = [
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "type": "function"
  }
];

document.addEventListener("DOMContentLoaded", async () => {
  const spinBtn = document.getElementById("spinBtn");
  const betButtons = document.querySelectorAll(".bet");
  const reels = document.querySelectorAll(".reel img");
  const balanceDisplay = document.getElementById("metBalance");
  const totalCreditsDisplay = document.getElementById("totalCredits");
  const connectBtn = document.getElementById("connectWallet");
  const cashOutBtn = document.getElementById("cashOutBtn");

  // BUY MET Section elements
  const usdInput = document.getElementById("usdAmount");
  const bnbInput = document.getElementById("bnbAmount");
  const calculateBtn = document.getElementById("calculateMetBtn");
  const buyBtn = document.getElementById("buyNowBtn");
  const outputLabel = document.getElementById("metEstimate");

  // New symbol list for paid game (6 reels)
  const symbols = [
    "seven.png",
    "coins1.png",
    "crown.png",
    "goldbar.png",
    "key.png",
    "chest.png"
  ];

  // Payouts for each symbol
  const payouts = {
    "seven.png": 150,
    "coins1.png": 100,
    "crown.png": 50,
    "goldbar.png": 20,
    "key.png": 10,
    "chest.png": 5
  };

  async function initWallet() {
    if (window.ethereum) {
      web3 = new Web3(window.ethereum);
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      walletAddress = accounts[0];
      connectBtn.textContent = walletAddress.slice(0,6) + "..." + walletAddress.slice(-4);
      tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
      await fetchBalance();
      spinBtn.disabled = false;
    } else {
      alert("MetaMask is required.");
    }
  }

  async function fetchBalance() {
    try {
      const res = await fetch(`${API_URL}/api/balance?wallet=${walletAddress}`);
      const data = await res.json();
      credits = parseFloat(data.credits || 0);
      updateBalanceDisplay();
    } catch (err) {
      console.error("Error fetching balance:", err);
    }
  }

  function updateBalanceDisplay() {
    balanceDisplay.textContent = `${credits.toFixed(2)} MET`;
    totalCreditsDisplay.textContent = `Credits: ${credits.toFixed(2)}`;
  }

  connectBtn.addEventListener("click", initWallet);

  const betValues = [1, 5, 10, 50, 100, 1000];
  betButtons.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      currentBet = betValues[i];
      console.log(`Bet set to ${currentBet} MET`);
    });
  });

  function animateReels() {
    reels.forEach((reel) => {
      reel.classList.add("spinning");
      setTimeout(() => reel.classList.remove("spinning"), 500);
    });
  }

  async function spinReels() {
    if (!walletAddress || currentBet <= 0 || credits < currentBet) {
      alert("Insufficient MET or no bet selected!");
      return;
    }

    // Deduct bet (off-chain)
    credits -= currentBet;
    updateBalanceDisplay();

    // Animate 6 reels
    const result = [];
    reels.forEach((reel, i) => {
      setTimeout(() => {
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        reel.src = `/assets/${symbol}`;
        result[i] = symbol;
      }, i * 200);
    });

    setTimeout(async () => {
      // Determine win: for simplicity, if first 3 reels match
      const win = (result[0] === result[1] && result[1] === result[2]);
      if (win) {
        const basePayout = payouts[result[0]] || 1;
        const winAmount = currentBet * basePayout * (30 / 100); // Using win percentage = 30% for paid game
        credits += winAmount;
        alert(`🎉 You win ${winAmount.toFixed(2)} MET!`);
        // Settle win on backend
        await fetch(`${API_URL}/api/settle-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, credits: winAmount })
        });
      } else {
        // Record loss
        await fetch(`${API_URL}/api/record-loss`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, amount: currentBet })
        });
      }
      await fetchBalance();
    }, 1200);
  }

  spinBtn.addEventListener("click", spinReels);

  // BUY MET Tokens Section
  calculateBtn.addEventListener("click", async () => {
    const usdVal = parseFloat(usdInput.value);
    const bnbVal = parseFloat(bnbInput.value);
    try {
      const res = await fetch(`${API_URL}/api/get-bnb-price`);
      const { bnbPrice } = await res.json();
      let usdAmount = 0, bnbAmount = 0;
      if (usdVal > 0) {
        usdAmount = usdVal;
        bnbAmount = usdVal / bnbPrice;
      } else if (bnbVal > 0) {
        bnbAmount = bnbVal;
        usdAmount = bnbVal * bnbPrice;
      } else {
        alert("Please enter a valid USD or BNB value.");
        return;
      }
      outputLabel.textContent = `You'll get ${usdAmount.toFixed(2)} MET = ${bnbAmount.toFixed(4)} BNB = $${usdAmount.toFixed(2)}`;
      buyBtn.setAttribute("data-usd", usdAmount.toFixed(2));
      buyBtn.setAttribute("data-bnb", bnbAmount.toFixed(6));
    } catch (err) {
      console.error("Conversion error:", err);
      outputLabel.textContent = "Error fetching price.";
    }
  });

  buyBtn.addEventListener("click", async () => {
    const usdAmount = buyBtn.getAttribute("data-usd");
    const bnbAmount = buyBtn.getAttribute("data-bnb");
    if (!walletAddress || !bnbAmount) return;
    try {
      await web3.eth.sendTransaction({
        from: walletAddress,
        to: "0x073f5CaDb9424Ce0a50a6E567AB87c2Be97D76F6", // House wallet
        value: web3.utils.toWei(bnbAmount, "ether")
      });
      alert("BNB sent. MET will be delivered shortly.");
      await fetch(`${API_URL}/api/confirm-purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyer: walletAddress, usdAmount })
      });
      await fetchBalance();
    } catch (err) {
      console.error("Buy transaction failed:", err);
      alert("Transaction failed.");
    }
  });

  // Initialize wallet and fetch balance on load
  await initWallet();
});
