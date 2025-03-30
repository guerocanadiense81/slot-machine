const API_URL = 'https://slot-machine-a08c.onrender.com';

let web3;
let walletAddress;
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

  let currentBet = 0;
  let winPercentage = 30;
  let credits = 0;

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
    if (!walletAddress || !tokenContract) return;
    const balanceWei = await tokenContract.methods.balanceOf(walletAddress).call();
    credits = parseFloat(web3.utils.fromWei(balanceWei, "ether"));
    balanceDisplay.textContent = `${credits.toFixed(2)} MET`;
  }

  async function fetchWinPercent() {
    try {
      const res = await fetch(`${API_URL}/api/get-win-percentages`);
      const data = await res.json();
      winPercentage = data.paid || 30;
    } catch (e) {
      console.warn("Win % fetch failed", e);
    }
  }

  async function spinReels() {
    if (!walletAddress || credits < currentBet || currentBet <= 0) {
      alert("Not enough MET or no bet selected!");
      return;
    }

    credits -= currentBet;
    balanceDisplay.textContent = `${credits.toFixed(2)} MET`;

    const symbols = ["b1.png", "b2.png", "b3.png", "ch.png", "s7.png", "sc.png"];
    const result = [];

    reels.forEach((reel, i) => {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      reel.src = `/assets/${symbol}`;
      result.push(symbol);
    });

    setTimeout(async () => {
      if (result[0] === result[1] && result[1] === result[2]) {
        const symbol = result[0].replace(".png", "");
        const base = payouts[symbol] || 1;
        const winAmount = currentBet * base * (winPercentage / 100);

        await fetch(`${API_URL}/api/settle-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, credits: winAmount })
        });

        await fetchMETBalance();
      } else {
        await fetch(`${API_URL}/api/record-loss`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, amount: currentBet })
        });

        await fetchMETBalance();
      }
    }, 800);
  }

  async function handleCashout() {
    const res = await fetch(`${API_URL}/api/settle-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress, credits })
    });

    const data = await res.json();
    if (data.success) {
      alert("Cashed out successfully!");
      await fetchMETBalance();
    } else {
      alert("Cashout failed.");
    }
  }

  async function handleBuy() {
    const bnb = buyBtn.getAttribute("data-bnb");
    const usd = buyBtn.getAttribute("data-usd");

    if (!walletAddress || !bnb || !usd) return;

    try {
      await web3.eth.sendTransaction({
        from: walletAddress,
        to: "0x073f5CaDb9424Ce0a50a6E567AB87c2Be97D76F6",
        value: web3.utils.toWei(bnb, "ether")
      });

      await fetch(`${API_URL}/api/confirm-purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, usdAmount: usd })
      });

      alert("Purchase complete! MET will reflect soon.");
      await fetchMETBalance();
    } catch (err) {
      console.error("Buy failed:", err);
      alert("Transaction failed.");
    }
  }

  async function calculateConversion() {
    const usdVal = parseFloat(usdInput.value);
    const bnbVal = parseFloat(bnbInput.value);

    const res = await fetch(`${API_URL}/api/get-bnb-price`);
    const { bnbPrice } = await res.json();

    let usd = 0;
    let bnb = 0;

    if (usdVal > 0) {
      usd = usdVal;
      bnb = usd / bnbPrice;
    } else if (bnbVal > 0) {
      bnb = bnbVal;
      usd = bnb * bnbPrice;
    } else {
      alert("Enter a valid USD or BNB amount.");
      return;
    }

    const metTokens = usd;
    outputLabel.textContent = `You'll get ${metTokens.toFixed(2)} MET = ${bnb.toFixed(4)} BNB = $${usd.toFixed(2)}`;
    buyBtn.setAttribute("data-bnb", bnb.toFixed(6));
    buyBtn.setAttribute("data-usd", usd.toFixed(2));
    buyBtn.setAttribute("data-met", metTokens.toFixed(2));
  }

  // Event bindings
  if (connectWalletBtn) connectWalletBtn.addEventListener("click", initWallet);
  if (spinBtn) spinBtn.addEventListener("click", spinReels);
  if (cashOutBtn) cashOutBtn.addEventListener("click", handleCashout);
  if (calculateBtn) calculateBtn.addEventListener("click", calculateConversion);
  if (buyBtn) buyBtn.addEventListener("click", handleBuy);

  betButtons.forEach((btn, idx) => {
    const bets = [1, 5, 10, 50, 100, 1000];
    btn.addEventListener("click", () => {
      currentBet = bets[idx];
      console.log("Bet selected:", currentBet);
    });
  });

  await fetchWinPercent();
});
