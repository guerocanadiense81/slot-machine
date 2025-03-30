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
    outputs: [{ name: "balance", "type": "uint256" }],
    type: "function"
  }
];

const symbolFiles = [
  "seven.png", "coins1.png", "chest.png", "crown.png", "bell.png", "key.png", "goldbar.png"
];

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
  const balanceDisplay = document.getElementById("metBalance");
  const spinBtn = document.getElementById("spinBtn");
  const betButtons = document.querySelectorAll(".bet");
  const reels = document.querySelectorAll(".reel img");
  const connectWalletBtn = document.getElementById("connectWallet");
  const cashOutBtn = document.getElementById("cashOutBtn");

  const usdInput = document.getElementById("usdAmount");
  const bnbInput = document.getElementById("bnbAmount");
  const calculateBtn = document.getElementById("calculateMetBtn");
  const buyBtn = document.getElementById("buyNowBtn");
  const outputLabel = document.getElementById("metEstimate");

  async function initWallet() {
    if (window.ethereum) {
      web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.requestAccounts();
      walletAddress = accounts[0];
      tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
      await fetchMETBalance();
      spinBtn.disabled = false;
    } else {
      alert("MetaMask is required.");
    }
  }

  async function fetchMETBalance() {
    const balanceWei = await tokenContract.methods.balanceOf(walletAddress).call();
    credits = parseFloat(web3.utils.fromWei(balanceWei, "ether"));
    updateCreditsDisplay();
  }

  function updateCreditsDisplay() {
    balanceDisplay.textContent = `${credits.toFixed(2)} MET`;
  }

  async function spinReels() {
    if (!walletAddress || credits < currentBet || currentBet <= 0) {
      alert("Not enough MET or bet not selected.");
      return;
    }

    credits -= currentBet;
    updateCreditsDisplay();

    const results = [];

    reels.forEach((reel, idx) => {
      setTimeout(() => {
        reel.classList.add("spin");
        setTimeout(() => {
          const symbol = symbolFiles[Math.floor(Math.random() * symbolFiles.length)];
          reel.src = `/assets/${symbol}`;
          reel.classList.remove("spin");
          results[idx] = symbol;
        }, 300);
      }, idx * 200);
    });

    setTimeout(async () => {
      const baseSymbol = results[0]?.split('.')[0];
      if (results.every(r => r.split('.')[0] === baseSymbol)) {
        const basePayout = payouts[baseSymbol] || 1;
        const winAmount = currentBet * basePayout * (winPercentage / 100);
        credits += winAmount;
        updateCreditsDisplay();

        await fetch(`${API_URL}/api/spin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, result: results, credits: winAmount })
        });
      } else {
        await fetch(`${API_URL}/api/spin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, result: results, credits: 0 })
        });
      }

      await fetchMETBalance();
    }, 1000);
  }

  if (connectWalletBtn) connectWalletBtn.addEventListener("click", initWallet);
  if (spinBtn) spinBtn.addEventListener("click", spinReels);

  if (cashOutBtn) {
    cashOutBtn.addEventListener("click", async () => {
      const res = await fetch(`${API_URL}/api/cashout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress })
      });
      const data = await res.json();
      if (data.success) {
        alert("Cashed out MET!");
        await fetchMETBalance();
      }
    });
  }

  if (calculateBtn) {
    calculateBtn.addEventListener("click", async () => {
      const usdVal = parseFloat(usdInput.value) || 0;
      const bnbVal = parseFloat(bnbInput.value) || 0;

      const res = await fetch(`${API_URL}/api/get-bnb-price`);
      const { bnbPrice } = await res.json();

      let usdAmount, bnbAmount;

      if (usdVal > 0) {
        usdAmount = usdVal;
        bnbAmount = usdVal / bnbPrice;
      } else if (bnbVal > 0) {
        bnbAmount = bnbVal;
        usdAmount = bnbVal * bnbPrice;
      } else {
        return alert("Enter valid USD or BNB.");
      }

      const metTokens = usdAmount;
      outputLabel.textContent = `You'll get ${metTokens} MET = ${bnbAmount.toFixed(4)} BNB ($${usdAmount})`;

      buyBtn.setAttribute("data-bnb", bnbAmount.toFixed(6));
      buyBtn.setAttribute("data-usd", usdAmount.toFixed(2));
    });
  }

  if (buyBtn) {
    buyBtn.addEventListener("click", async () => {
      const bnbAmount = buyBtn.getAttribute("data-bnb");
      const usdAmount = buyBtn.getAttribute("data-usd");

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

      alert("BNB sent, MET will arrive shortly.");
      await fetchMETBalance();
    });
  }
});
