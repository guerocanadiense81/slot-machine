const API_URL = 'https://slot-machine-a08c.onrender.com';

let web3;
let walletAddress;
let credits = 0;
let tokenContract;

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

const symbols = ["seven", "coins1", "chest", "crown", "bell", "key", "goldbar"];
const payouts = {
  "seven": 150,
  "coins1": 100,
  "chest": 50,
  "crown": 20,
  "bell": 10,
  "key": 5,
  "goldbar": 2
};

document.addEventListener("DOMContentLoaded", async () => {
  const spinBtn = document.getElementById("spinBtn");
  const reels = document.querySelectorAll(".reel img");
  const betButtons = document.querySelectorAll(".bet");
  const balanceDisplay = document.getElementById("metBalance");
  const cashOutBtn = document.getElementById("cashOutBtn");

  const usdInput = document.getElementById("usdAmount");
  const bnbInput = document.getElementById("bnbAmount");
  const calculateBtn = document.getElementById("calculateMetBtn");
  const buyBtn = document.getElementById("buyNowBtn");
  const outputLabel = document.getElementById("metEstimate");

  let currentBet = 0;
  let winPercentage = 30;

  async function initWallet() {
    if (!window.ethereum) return alert("Please install MetaMask!");
    web3 = new Web3(window.ethereum);

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      walletAddress = accounts[0];
      tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
      fetchCredits();
    } catch (err) {
      console.error("Wallet connection error:", err);
    }
  }

  async function fetchCredits() {
    const res = await fetch(`${API_URL}/api/get-balance?wallet=${walletAddress}`);
    const data = await res.json();
    credits = data.credits || 0;
    updateDisplay();
  }

  function updateDisplay() {
    balanceDisplay.textContent = `${credits.toFixed(2)} MET`;
    document.getElementById("totalCredits").textContent = `Credits: ${credits.toFixed(2)}`;
  }

  async function fetchWinPercentage() {
    const res = await fetch(`${API_URL}/api/get-win-percentages`);
    const data = await res.json();
    winPercentage = data.paid || 30;
  }

  async function spinReels() {
    if (credits < currentBet) return alert("Insufficient credits!");
    credits -= currentBet;
    updateDisplay();

    const result = [];
    for (let i = 0; i < reels.length; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      result[i] = symbol;
      animateReel(reels[i], symbol, i);
    }

    setTimeout(async () => {
      if (result[0] === result[1] && result[1] === result[2]) {
        const winAmount = currentBet * (payouts[result[0]] || 1) * (winPercentage / 100);
        credits += winAmount;
        updateDisplay();

        await fetch(`${API_URL}/api/record-win`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, amount: winAmount })
        });
      } else {
        await fetch(`${API_URL}/api/record-loss`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, amount: currentBet })
        });
      }
    }, 1200);
  }

  function animateReel(reel, symbol, index) {
    reel.classList.add("spinning");
    setTimeout(() => {
      reel.src = `/assets/${symbol}.png`;
      reel.classList.remove("spinning");
    }, 600 + index * 100);
  }

  betButtons.forEach((btn, i) => {
    const betValues = [1, 5, 10, 50, 100, 1000];
    btn.addEventListener("click", () => {
      currentBet = betValues[i];
    });
  });

  spinBtn.addEventListener("click", spinReels);

  cashOutBtn.addEventListener("click", async () => {
    const res = await fetch(`${API_URL}/api/cashout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress, credits })
    });
    const data = await res.json();
    if (data.success) {
      alert("Cashed out MET!");
      fetchCredits();
    } else {
      alert("Cash out failed.");
    }
  });

  calculateBtn.addEventListener("click", async () => {
    const usdVal = parseFloat(usdInput.value);
    const bnbVal = parseFloat(bnbInput.value);

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
      return alert("Enter USD or BNB value.");
    }

    const metTokens = usdAmount;
    outputLabel.textContent = `Buy ${metTokens} MET = ${bnbAmount.toFixed(4)} BNB ($${usdAmount})`;

    buyBtn.setAttribute("data-bnb", bnbAmount.toFixed(6));
    buyBtn.setAttribute("data-usd", usdAmount.toFixed(2));
  });

  buyBtn.addEventListener("click", async () => {
    const bnbAmount = buyBtn.getAttribute("data-bnb");
    const usdAmount = buyBtn.getAttribute("data-usd");

    try {
      await web3.eth.sendTransaction({
        from: walletAddress,
        to: "0x073f5CaDb9424Ce0a50a6E567AB87c2Be97D76F6",
        value: web3.utils.toWei(bnbAmount, "ether")
      });

      // Trigger backend confirmation
      await fetch(`${API_URL}/api/confirm-purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyer: walletAddress, usdAmount })
      });

      alert("Purchase complete! MET will appear soon.");
      fetchCredits();
    } catch (err) {
      console.error("Buy failed:", err);
      alert("Transaction failed.");
    }
  });

  document.getElementById("connectWallet").addEventListener("click", initWallet);

  await fetchWinPercentage();
});
