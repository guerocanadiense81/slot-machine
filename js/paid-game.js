// /js/paid-game.js
const API_URL = 'https://slot-machine-a08c.onrender.com';

let web3, walletAddress, tokenContract, currentBet = 0, credits = 0;
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
  const spinBtn = document.getElementById("spinBtn");
  const reels = document.querySelectorAll(".reel img");
  const betButtons = document.querySelectorAll(".bet");
  const balanceDisplay = document.getElementById("metBalance");
  const totalCreditsDisplay = document.getElementById("totalCredits");
  const connectBtn = document.getElementById("connectWallet");
  const usdInput = document.getElementById("usdAmount");
  const bnbInput = document.getElementById("bnbAmount");
  const estimateLabel = document.getElementById("metEstimate");
  const calculateBtn = document.getElementById("calculateMetBtn");
  const buyBtn = document.getElementById("buyNowBtn");

  const symbols = ["seven.png", "coins1.png", "chest.png", "crown.png", "goldbar.png", "bell.png", "key.png"];
  const payouts = {
    "seven.png": 150,
    "coins1.png": 100,
    "chest.png": 50,
    "crown.png": 20,
    "goldbar.png": 10,
    "bell.png": 5,
    "key.png": 2
  };

  async function initWeb3() {
    if (window.ethereum) {
      web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.requestAccounts();
      walletAddress = accounts[0];
      tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
      await fetchBalance();
    } else {
      alert("Please install MetaMask!");
    }
  }

  async function fetchBalance() {
    const res = await fetch(`${API_URL}/api/balance?wallet=${walletAddress}`);
    const data = await res.json();
    credits = parseFloat(data.credits || 0);
    balanceDisplay.textContent = `${credits.toFixed(2)} MET`;
    totalCreditsDisplay.textContent = `Credits: ${credits.toFixed(2)}`;
  }

  connectBtn.addEventListener("click", initWeb3);

  betButtons.forEach((btn, idx) => {
    const betValues = [1, 5, 10, 50, 100, 1000];
    btn.addEventListener("click", () => {
      currentBet = betValues[idx];
    });
  });

  spinBtn.addEventListener("click", async () => {
    if (!walletAddress || credits < currentBet || currentBet <= 0) return alert("Not enough MET or no bet selected.");

    const result = [];
    reels.forEach((reel, i) => {
      reel.classList.add("spinning");
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      setTimeout(() => {
        reel.src = `/assets/${symbol}`;
        reel.classList.remove("spinning");
        result[i] = symbol;
      }, i * 200);
    });

    await fetch(`${API_URL}/api/spin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: walletAddress, bet: currentBet, result })
    });

    setTimeout(fetchBalance, 1000);
  });

  calculateBtn.addEventListener("click", async () => {
    const usdVal = parseFloat(usdInput.value);
    const bnbVal = parseFloat(bnbInput.value);

    const res = await fetch(`${API_URL}/api/get-bnb-price`);
    const { bnbPrice } = await res.json();

    let usd = usdVal, bnb = bnbVal;
    if (usdVal > 0) bnb = usdVal / bnbPrice;
    else if (bnbVal > 0) usd = bnbVal * bnbPrice;
    else return alert("Enter USD or BNB");

    estimateLabel.textContent = `Buy ${usd.toFixed(2)} MET = ${bnb.toFixed(4)} BNB`;
    buyBtn.setAttribute("data-usd", usd.toFixed(2));
    buyBtn.setAttribute("data-bnb", bnb.toFixed(6));
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

    alert("MET tokens will be sent shortly!");
    fetchBalance();
  });

  await initWeb3();
});
