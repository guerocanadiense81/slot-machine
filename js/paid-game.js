const API_URL = 'https://slot-machine-a08c.onrender.com';

let web3;
let walletAddress;
let credits = 0;

const symbolFiles = [
  "seven.png",     // payout 150
  "coins1.png",    // 100
  "chest.png",     // 50
  "crown.png",     // 20
  "goldbar.png",   // 10
  "bell.png",      // 5
  "key.png"        // 2
];

const payouts = {
  "seven.png": 150,
  "coins1.png": 100,
  "chest.png": 50,
  "crown.png": 20,
  "goldbar.png": 10,
  "bell.png": 5,
  "key.png": 2
};

document.addEventListener("DOMContentLoaded", async () => {
  const spinBtn = document.getElementById("spinBtn");
  const connectBtn = document.getElementById("connectWallet");
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
  let bnbPrice = 0;

  async function fetchCredits() {
    const res = await fetch(`${API_URL}/api/balance?wallet=${walletAddress}`);
    const data = await res.json();
    credits = data.credits || 0;
    balanceDisplay.textContent = `${credits.toFixed(2)} MET`;
  }

  async function connectWallet() {
    if (window.ethereum) {
      web3 = new Web3(window.ethereum);
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      walletAddress = accounts[0];
      await fetchCredits();
      spinBtn.disabled = false;
    } else {
      alert("Please install MetaMask");
    }
  }

  connectBtn.addEventListener("click", connectWallet);

  betButtons.forEach((btn, i) => {
    const values = [1, 5, 10, 50, 100, 1000];
    btn.addEventListener("click", () => {
      currentBet = values[i];
    });
  });

  async function spinReels() {
    if (credits < currentBet || currentBet <= 0) {
      alert("Insufficient credits.");
      return;
    }

    reels.forEach(reel => reel.classList.add("spinning"));
    const result = [];

    setTimeout(() => {
      reels.forEach((reel, i) => {
        const symbol = symbolFiles[Math.floor(Math.random() * symbolFiles.length)];
        reel.src = `/assets/${symbol}`;
        reel.classList.remove("spinning");
        result[i] = symbol;
      });

      const isWin = result[0] === result[1] && result[1] === result[2];
      const payload = {
        wallet: walletAddress,
        bet: currentBet,
        result: result.join(","),
        win: isWin
      };

      fetch(`${API_URL}/api/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(res => res.json())
        .then(data => {
          credits = data.newCredits;
          balanceDisplay.textContent = `${credits.toFixed(2)} MET`;
          if (isWin) alert(`🎉 You won ${data.winAmount} MET!`);
        });
    }, 1000);
  }

  spinBtn.addEventListener("click", spinReels);

  if (cashOutBtn) {
    cashOutBtn.addEventListener("click", async () => {
      const res = await fetch(`${API_URL}/api/cashout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress })
      });
      const data = await res.json();
      if (data.success) {
        alert("Cashout sent!");
        await fetchCredits();
      } else {
        alert("Cashout failed.");
      }
    });
  }

  calculateBtn.addEventListener("click", async () => {
    const usd = parseFloat(usdInput.value);
    const bnb = parseFloat(bnbInput.value);

    const res = await fetch(`${API_URL}/api/get-bnb-price`);
    const data = await res.json();
    bnbPrice = data.bnbPrice;

    let usdAmount = usd > 0 ? usd : bnb * bnbPrice;
    let bnbAmount = usd > 0 ? usd / bnbPrice : bnb;

    outputLabel.textContent = `Buy ${usdAmount} MET = ${bnbAmount.toFixed(4)} BNB = $${usdAmount}`;
    buyBtn.setAttribute("data-usd", usdAmount.toFixed(2));
    buyBtn.setAttribute("data-bnb", bnbAmount.toFixed(6));
  });

  buyBtn.addEventListener("click", async () => {
    const usdAmount = buyBtn.getAttribute("data-usd");
    const bnbAmount = buyBtn.getAttribute("data-bnb");

    await web3.eth.sendTransaction({
      from: walletAddress,
      to: "0x073f5CaDb9424Ce0a50a6E567AB87c2Be97D76F6",
      value: web3.utils.toWei(bnbAmount, "ether")
    });

    await fetch(`${API_URL}/api/confirm-purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyer: walletAddress, usdAmount })
    });

    alert("MET will be delivered shortly.");
    await fetchCredits();
  });
});
