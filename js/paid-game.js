const API_URL = 'https://slot-machine-a08c.onrender.com';

let web3, walletAddress = "", credits = 0;
const payouts = {
  "seven.png": 150,
  "crown.png": 100,
  "chest.png": 50,
  "goldbar.png": 20,
  "coins1.png": 10,
  "bell.png": 5,
  "key.png": 2
};
const symbolFiles = Object.keys(payouts);

// DOM refs
const spinBtn = document.getElementById("spinBtn");
const reels = document.querySelectorAll(".reel img");
const connectBtn = document.getElementById("connectWallet");
const betButtons = document.querySelectorAll(".bet");
const creditDisplay = document.getElementById("totalCredits");
const usdInput = document.getElementById("usdAmount");
const bnbInput = document.getElementById("bnbAmount");
const outputLabel = document.getElementById("metEstimate");
const calculateBtn = document.getElementById("calculateMetBtn");
const buyBtn = document.getElementById("buyNowBtn");

let currentBet = 0;
let bnbPrice = 0;

async function initWallet() {
  if (window.ethereum) {
    web3 = new Web3(window.ethereum);
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    walletAddress = accounts[0];
    document.getElementById("walletAddress").innerText = `Wallet: ${walletAddress}`;
    await fetchBalance();
  } else {
    alert("Please install MetaMask!");
  }
}

async function fetchBalance() {
  const res = await fetch(`${API_URL}/api/balance?wallet=${walletAddress}`);
  const data = await res.json();
  credits = data.credits || 0;
  updateCredits();
}

function updateCredits() {
  creditDisplay.textContent = `Credits: ${credits.toFixed(2)}`;
}

function animateReel(reel, finalSymbol, delay) {
  reel.classList.add("spinning");
  setTimeout(() => {
    reel.src = `/assets/${finalSymbol}`;
    reel.classList.remove("spinning");
  }, delay);
}

async function handleSpin() {
  if (credits < currentBet || currentBet <= 0) {
    return alert("Not enough credits or invalid bet.");
  }

  const result = [];
  for (let i = 0; i < reels.length; i++) {
    const symbol = symbolFiles[Math.floor(Math.random() * symbolFiles.length)];
    result.push(symbol);
    animateReel(reels[i], symbol, 600 + i * 200);
  }

  credits -= currentBet;
  updateCredits();

  setTimeout(async () => {
    if (result.every(s => s === result[0])) {
      const winAmount = currentBet * (payouts[result[0]] || 1);
      credits += winAmount;
      alert(`🎉 You won ${winAmount} credits!`);
    } else {
      alert("❌ No win, try again!");
    }

    await fetch(`${API_URL}/api/spin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: walletAddress, bet: currentBet, outcome: result })
    });

    updateCredits();
  }, 1500);
}

async function fetchBNBPrice() {
  const res = await fetch(`${API_URL}/api/get-bnb-price`);
  const data = await res.json();
  bnbPrice = data.bnbPrice;
}

async function handleBuyMET() {
  const usd = parseFloat(usdInput.value);
  const bnb = parseFloat(bnbInput.value);
  let usdAmount = 0, bnbAmount = 0;

  if (usd > 0) {
    usdAmount = usd;
    bnbAmount = usd / bnbPrice;
  } else if (bnb > 0) {
    bnbAmount = bnb;
    usdAmount = bnb * bnbPrice;
  } else {
    return alert("Enter USD or BNB value.");
  }

  outputLabel.textContent = `≈ ${usdAmount.toFixed(2)} MET for ${bnbAmount.toFixed(4)} BNB`;

  buyBtn.onclick = async () => {
    await web3.eth.sendTransaction({
      from: walletAddress,
      to: "0x073f5CaDb9424Ce0a50a6E567AB87c2Be97D76F6",
      value: web3.utils.toWei(bnbAmount.toString(), "ether")
    });

    await fetch(`${API_URL}/api/confirm-purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyer: walletAddress, usdAmount })
    });

    alert("✅ BNB sent. MET will arrive shortly.");
    await fetchBalance();
  };
}

// Events
connectBtn?.addEventListener("click", initWallet);
spinBtn?.addEventListener("click", handleSpin);
calculateBtn?.addEventListener("click", async () => {
  await fetchBNBPrice();
  handleBuyMET();
});
betButtons.forEach((btn, i) => {
  const betValues = [1, 5, 10, 25, 50, 100];
  btn.addEventListener("click", () => {
    currentBet = betValues[i];
    console.log(`Bet: ${currentBet}`);
  });
});

fetchBNBPrice();
