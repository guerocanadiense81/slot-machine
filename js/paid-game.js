const API_URL = 'https://slot-machine-a08c.onrender.com';

let web3;
let walletAddress;
let credits = 0;
let currentBet = 0;
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
  const reels = document.querySelectorAll(".reel img");
  const connectWalletBtn = document.getElementById("connectWallet");
  const cashOutBtn = document.getElementById("cashOutBtn");

  const usdInput = document.getElementById("usdAmount");
  const bnbInput = document.getElementById("bnbAmount");
  const calculateBtn = document.getElementById("calculateMetBtn");
  const buyBtn = document.getElementById("buyNowBtn");
  const outputLabel = document.getElementById("metEstimate");

  const payouts = {
    "seven": 150,
    "chest": 100,
    "coins1": 50,
    "goldbar": 20,
    "crown": 10,
    "bell": 5,
    "key": 2
  };

  const symbols = Object.keys(payouts);

  async function initWallet() {
    if (window.ethereum) {
      web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.requestAccounts();
      walletAddress = accounts[0];
      tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
      await fetchCredits();
    } else {
      alert("Please install MetaMask.");
    }
  }

  async function fetchCredits() {
    try {
      const res = await fetch(`${API_URL}/api/balance/${walletAddress}`);
      const data = await res.json();
      credits = data.credits || 0;
      balanceDisplay.textContent = `${credits.toFixed(2)} MET`;
    } catch (err) {
      console.error("Fetch balance error", err);
    }
  }

  connectWalletBtn.addEventListener("click", initWallet);

  spinBtn.addEventListener("click", async () => {
    if (!walletAddress || currentBet <= 0 || credits < currentBet) {
      alert("Insufficient balance or no bet selected.");
      return;
    }

    const result = await fetch(`${API_URL}/api/spin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress, bet: currentBet })
    }).then(res => res.json());

    if (!result.success) return alert("Spin error.");

    const { spinResult, winAmount } = result;

    spinResult.forEach((symbol, i) => {
      setTimeout(() => {
        reels[i].classList.add("spinning");
        setTimeout(() => {
          reels[i].src = `/assets/${symbol}.png`;
          reels[i].classList.remove("spinning");
        }, 500);
      }, i * 300);
    });

    credits = result.newBalance;
    balanceDisplay.textContent = `${credits.toFixed(2)} MET`;

    if (winAmount > 0) {
      alert(`🎉 You won ${winAmount} MET!`);
    }
  });

  cashOutBtn.addEventListener("click", async () => {
    const res = await fetch(`${API_URL}/api/cashout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress })
    });
    const data = await res.json();
    if (data.success) {
      alert("Cashout successful!");
      await fetchCredits();
    } else {
      alert("Cashout failed.");
    }
  });

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
      return alert("Enter valid USD or BNB");
    }

    outputLabel.textContent = `You'll get ${usdAmount.toFixed(2)} MET for ${bnbAmount.toFixed(4)} BNB`;

    buyBtn.setAttribute("data-usd", usdAmount);
    buyBtn.setAttribute("data-bnb", bnbAmount);
  });

  buyBtn.addEventListener("click", async () => {
    const usdAmount = parseFloat(buyBtn.getAttribute("data-usd"));
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

      alert("MET will be added to your balance shortly.");
      await fetchCredits();
    } catch (err) {
      console.error("Buy error", err);
      alert("Transaction failed.");
    }
  });

  const betButtons = document.querySelectorAll(".bet");
  const betValues = [1, 5, 10, 50, 100, 1000];
  betButtons.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      currentBet = betValues[i];
    });
  });
});
