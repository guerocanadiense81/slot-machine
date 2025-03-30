const API_URL = 'https://slot-machine-a08c.onrender.com';

let web3;
let walletAddress;
let tokenContract;
let credits = 0;
let currentBet = 0;
let winPercentage = 30;

const tokenAddress = "0xb80b92Be7402E1e2D3189fff261D672D8104b322";
const tokenABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function"
  }
];

document.addEventListener("DOMContentLoaded", async () => {
  // DOM Elements
  const balanceDisplay = document.getElementById("metBalance");
  const spinBtn = document.getElementById("spinBtn");
  const betButtons = document.querySelectorAll(".bet");
  const reels = document.querySelectorAll(".reel img");
  const connectWalletBtn = document.getElementById("connectWallet");
  const cashOutBtn = document.getElementById("cashOutBtn");
  const totalCreditsDisplay = document.getElementById("totalCredits");

  // BUY Section
  const usdInput = document.getElementById("usdAmount");
  const bnbInput = document.getElementById("bnbAmount");
  const calculateBtn = document.getElementById("calculateMetBtn");
  const buyBtn = document.getElementById("buyNowBtn");
  const outputLabel = document.getElementById("metEstimate");

  const payouts = {
    "ch": 50,
    "s7": 10,
    "sc": 5,
    "b3": 4,
    "b2": 3,
    "b1": 2
  };

  async function initWallet() {
    if (window.ethereum) {
      web3 = new Web3(window.ethereum);
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        walletAddress = accounts[0];
        tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
        await fetchMETBalance();
        spinBtn.disabled = false;
      } catch (err) {
        console.error("Wallet connect error", err);
      }
    } else {
      alert("MetaMask required.");
    }
  }

  async function fetchMETBalance() {
    if (!walletAddress || !tokenContract) return;
    try {
      const balanceWei = await tokenContract.methods.balanceOf(walletAddress).call();
      credits = parseFloat(web3.utils.fromWei(balanceWei, "ether"));
      updateCreditsDisplay();
    } catch (err) {
      console.error("Error fetching MET balance:", err);
    }
  }

  function updateCreditsDisplay() {
    if (balanceDisplay) balanceDisplay.textContent = `${credits.toFixed(2)} MET`;
    if (totalCreditsDisplay) totalCreditsDisplay.textContent = `Credits: ${credits.toFixed(2)}`;
  }

  async function fetchWinPercent() {
    try {
      const res = await fetch(`${API_URL}/api/get-win-percentages`);
      const data = await res.json();
      winPercentage = data.paid || 30;
    } catch (err) {
      console.error("Win % fetch error:", err);
    }
  }

  async function spinReels() {
    if (!walletAddress || credits < currentBet || currentBet <= 0) {
      alert("Not enough MET or no bet selected!");
      return;
    }

    credits -= currentBet;
    updateCreditsDisplay();

    const result = [];
    const symbols = ["b1.png", "b2.png", "b3.png", "ch.png", "s7.png", "sc.png"];

    reels.forEach((reel, idx) => {
      setTimeout(() => {
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        reel.src = `/assets/${symbol}`;
        result[idx] = symbol;
      }, idx * 200);
    });

    setTimeout(async () => {
      if (result[0] === result[1] && result[1] === result[2]) {
        const basePayout = payouts[result[0]] || 1;
        const winAmount = currentBet * basePayout * (winPercentage / 100);
        credits += winAmount;
        updateCreditsDisplay();

        await fetch(`${API_URL}/api/settle-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, credits: winAmount }),
        });
      } else {
        await fetch(`${API_URL}/api/record-loss`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, amount: currentBet }),
        });
      }

      await fetchMETBalance();
    }, 1000);
  }

  // EVENTS
  if (connectWalletBtn) connectWalletBtn.addEventListener("click", initWallet);
  if (spinBtn) spinBtn.addEventListener("click", spinReels);

  if (cashOutBtn) {
    cashOutBtn.addEventListener("click", async () => {
      const payload = { walletAddress, credits };
      const res = await fetch(`${API_URL}/api/settle-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        alert("Session cashed out!");
        await fetchMETBalance();
      } else {
        alert("Cash out failed.");
      }
    });
  }

  // Bet buttons
  const betValues = [1, 5, 10, 50, 100, 1000];
  betButtons.forEach((button, i) => {
    button.addEventListener("click", () => {
      currentBet = betValues[i];
      console.log("Selected Bet:", currentBet);
    });
  });

  // BUY MET - Conversion + Transaction
  if (calculateBtn) {
    calculateBtn.addEventListener("click", async () => {
      const usdVal = parseFloat(usdInput.value);
      const bnbVal = parseFloat(bnbInput.value);

      try {
        const res = await fetch(`${API_URL}/api/get-bnb-price`);
        const data = await res.json();
        const bnbPrice = data.bnbPrice;

        let usdAmount = 0;
        let bnbAmount = 0;

        if (usdVal > 0) {
          usdAmount = usdVal;
          bnbAmount = usdVal / bnbPrice;
        } else if (bnbVal > 0) {
          bnbAmount = bnbVal;
          usdAmount = bnbVal * bnbPrice;
        } else {
          alert("Enter valid USD or BNB amount.");
          return;
        }

        const metTokens = usdAmount;
        outputLabel.textContent = `You'll get ${metTokens} MET = ${bnbAmount.toFixed(4)} BNB = $${usdAmount.toFixed(2)}`;

        buyBtn.setAttribute("data-bnb", bnbAmount.toFixed(6));
        buyBtn.setAttribute("data-met", metTokens.toFixed(2));
      } catch (err) {
        console.error("Conversion error:", err);
        outputLabel.textContent = "Error getting price.";
      }
    });
  }

  if (buyBtn) {
    buyBtn.addEventListener("click", async () => {
      const bnbAmount = buyBtn.getAttribute("data-bnb");
      if (!walletAddress || !bnbAmount) return;

      try {
        await web3.eth.sendTransaction({
          from: walletAddress,
          to: "0x073f5CaDb9424Ce0a50a6E567AB87c2Be97D76F6",
          value: web3.utils.toWei(bnbAmount, "ether")
        });
        alert("Transaction sent. MET will be delivered shortly.");
        await fetchMETBalance();
      } catch (err) {
        console.error("Transaction failed:", err);
        alert("Transaction failed.");
      }
    });
  }

  // Init win % on load
  await fetchWinPercent();
});
