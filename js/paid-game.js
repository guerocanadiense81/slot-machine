const API_URL = 'https://slot-machine-a08c.onrender.com';

let web3;
let walletAddress;
let credits = 0;
let currentBet = 0;
let winPercentage = 30;

const payouts = {
  "ch": 150,
  "s7": 100,
  "sc": 50,
  "b3": 20,
  "b2": 5,
  "b1": 2
};

const symbols = ["b1", "b2", "b3", "ch", "s7", "sc"];

document.addEventListener("DOMContentLoaded", async () => {
  const reels = document.querySelectorAll(".reel img");
  const balanceDisplay = document.getElementById("metBalance");
  const creditsDisplay = document.getElementById("totalCredits");
  const connectWalletBtn = document.getElementById("connectWallet");
  const spinBtn = document.getElementById("spinBtn");
  const cashOutBtn = document.getElementById("cashOutBtn");

  const usdInput = document.getElementById("usdAmount");
  const bnbInput = document.getElementById("bnbAmount");
  const calculateBtn = document.getElementById("calculateMetBtn");
  const buyBtn = document.getElementById("buyNowBtn");
  const outputLabel = document.getElementById("metEstimate");

  const betButtons = document.querySelectorAll(".bet");
  const betValues = [1, 5, 10, 50, 100, 1000];

  // Connect Wallet
  connectWalletBtn.addEventListener("click", async () => {
    if (window.ethereum) {
      web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.requestAccounts();
      walletAddress = accounts[0];
      document.getElementById("walletAddress").innerText = `Wallet: ${walletAddress}`;
      fetchBalance();
    } else {
      alert("Install MetaMask.");
    }
  });

  // Fetch off-chain balance
  async function fetchBalance() {
    const res = await fetch(`${API_URL}/api/get-balance?wallet=${walletAddress}`);
    const data = await res.json();
    credits = data.credits || 0;
    updateUI();
  }

  function updateUI() {
    balanceDisplay.textContent = `${credits.toFixed(2)} MET`;
    creditsDisplay.textContent = `Credits: ${credits.toFixed(2)}`;
    spinBtn.disabled = credits <= 0;
  }

  // Fetch win %
  const winData = await fetch(`${API_URL}/api/get-win-percentages`);
  const winJson = await winData.json();
  winPercentage = winJson.paid;

  // Spin reels with animation
  spinBtn.addEventListener("click", async () => {
    if (!walletAddress || credits < currentBet) {
      return alert("Not enough credits.");
    }

    const result = [];
    for (let i = 0; i < reels.length; i++) {
      await new Promise((res) => setTimeout(res, 200));
      const rand = symbols[Math.floor(Math.random() * symbols.length)];
      reels[i].src = `/assets/${rand}.png`;
      result.push(rand);
    }

    // Call backend spin logic
    const spinRes = await fetch(`${API_URL}/api/spin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: walletAddress, bet: currentBet, result }),
    });

    const data = await spinRes.json();
    credits = data.credits;
    updateUI();
  });

  // Cash out
  cashOutBtn.addEventListener("click", async () => {
    const res = await fetch(`${API_URL}/api/cashout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: walletAddress }),
    });

    const data = await res.json();
    if (data.success) {
      alert("Cashed out! MET on the way.");
      credits = 0;
      updateUI();
    } else {
      alert("Cashout failed.");
    }
  });

  // Set bet value
  betButtons.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      currentBet = betValues[i];
    });
  });

  // Buy MET tokens logic
  calculateBtn.addEventListener("click", async () => {
    const usd = parseFloat(usdInput.value) || 0;
    const bnb = parseFloat(bnbInput.value) || 0;

    const res = await fetch(`${API_URL}/api/get-bnb-price`);
    const { bnbPrice } = await res.json();

    let usdAmount = usd;
    let bnbAmount = bnb;

    if (usd > 0) {
      bnbAmount = usd / bnbPrice;
    } else if (bnb > 0) {
      usdAmount = bnb * bnbPrice;
    } else {
      return alert("Enter USD or BNB");
    }

    outputLabel.textContent = `Buy ${usdAmount.toFixed(2)} MET = ${bnbAmount.toFixed(4)} BNB`;
    buyBtn.setAttribute("data-usd", usdAmount.toFixed(2));
    buyBtn.setAttribute("data-bnb", bnbAmount.toFixed(6));
  });

  buyBtn.addEventListener("click", async () => {
    const usdAmount = buyBtn.getAttribute("data-usd");
    const bnbAmount = buyBtn.getAttribute("data-bnb");

    try {
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

      alert("MET tokens are on the way!");
      fetchBalance();
    } catch (err) {
      console.error("Buy failed", err);
    }
  });
});
