const API_URL = 'https://slot-machine-a08c.onrender.com';

let web3;
let walletAddress = "";
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

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  await initWeb3();

  const spinBtn = document.getElementById("spinBtn");
  const cashOutBtn = document.getElementById("cashOutBtn");
  const betButtons = document.querySelectorAll(".bet");
  const reels = document.querySelectorAll(".reel img");

  // Set win percentage
  fetch(`${API_URL}/api/get-win-percentages`)
    .then(res => res.json())
    .then(data => winPercentage = data.paid);

  // Bet buttons
  const betValues = [1, 5, 10, 50, 100, 1000];
  betButtons.forEach((btn, index) => {
    btn.addEventListener("click", () => {
      currentBet = betValues[index];
      console.log(`Bet: ${currentBet} MET`);
    });
  });

  spinBtn.addEventListener("click", async () => {
    if (credits < currentBet || currentBet <= 0) {
      alert("Not enough MET or no bet selected!");
      return;
    }

    const symbolFiles = ["b1.png", "b2.png", "b3.png", "ch.png", "s7.png", "sc.png"];
    const result = [];

    credits -= currentBet;
    updateCreditsDisplay();

    reels.forEach((reel, i) => {
      setTimeout(() => {
        const symbol = symbolFiles[Math.floor(Math.random() * symbolFiles.length)];
        reel.src = `/assets/${symbol}`;
        result[i] = symbol;
      }, i * 200);
    });

    setTimeout(async () => {
      if (result[0] === result[1] && result[1] === result[2]) {
        const payouts = { ch: 50, s7: 10, sc: 5, b3: 4, b2: 3, b1: 2 };
        const winAmount = currentBet * (payouts[result[0]] || 1) * (winPercentage / 100);
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
  });

  cashOutBtn.addEventListener("click", async () => {
    const res = await fetch(`${API_URL}/api/settle-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress, credits }),
    });

    const data = await res.json();
    if (data.success) {
      alert("Session settled!");
      await fetchMETBalance();
    } else {
      alert("Cash out failed.");
    }
  });

  setupBuyMET();
});

async function initWeb3() {
  if (window.ethereum) {
    web3 = new Web3(window.ethereum);
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    walletAddress = accounts[0];

    tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
    document.getElementById("walletAddress")?.innerText = `Wallet: ${walletAddress}`;
    await fetchMETBalance();
  } else {
    alert("MetaMask is required.");
  }
}

async function fetchMETBalance() {
  try {
    const balanceWei = await tokenContract.methods.balanceOf(walletAddress).call();
    credits = parseFloat(web3.utils.fromWei(balanceWei, "ether"));
    updateCreditsDisplay();
  } catch (err) {
    console.error("Failed to fetch MET balance", err);
  }
}

function updateCreditsDisplay() {
  document.getElementById("metBalance").innerText = `${credits.toFixed(2)} MET`;
  document.getElementById("totalCredits").innerText = `Credits: ${credits.toFixed(2)}`;
}

function setupBuyMET() {
  const usdInput = document.getElementById("usdAmount");
  const bnbInput = document.getElementById("bnbAmount");
  const calculateBtn = document.getElementById("calculateMetBtn");
  const buyBtn = document.getElementById("buyNowBtn");
  const estimate = document.getElementById("metEstimate");

  let bnbPrice = 0;

  calculateBtn.addEventListener("click", async () => {
    const usdVal = parseFloat(usdInput.value);
    const bnbVal = parseFloat(bnbInput.value);

    const res = await fetch(`${API_URL}/api/get-bnb-price`);
    const data = await res.json();
    bnbPrice = data.bnbPrice;

    let usdAmount = 0;
    let bnbAmount = 0;

    if (usdVal > 0) {
      usdAmount = usdVal;
      bnbAmount = usdVal / bnbPrice;
    } else if (bnbVal > 0) {
      bnbAmount = bnbVal;
      usdAmount = bnbVal * bnbPrice;
    } else {
      alert("Enter either USD or BNB.");
      return;
    }

    const metTokens = usdAmount;

    estimate.textContent = `You'll get ${metTokens.toFixed(2)} MET\n= ${bnbAmount.toFixed(4)} BNB\n= $${usdAmount.toFixed(2)}`;
    buyBtn.setAttribute("data-bnb", bnbAmount);
    buyBtn.setAttribute("data-met", metTokens);
  });

  buyBtn.addEventListener("click", async () => {
    const bnbAmount = buyBtn.getAttribute("data-bnb");
    if (!bnbAmount || parseFloat(bnbAmount) <= 0) {
      alert("Invalid BNB amount.");
      return;
    }

    try {
      await web3.eth.sendTransaction({
        from: walletAddress,
        to: "0x073f5CaDb9424Ce0a50a6E567AB87c2Be97D76F6", // MET receiving wallet
        value: web3.utils.toWei(bnbAmount, "ether"),
      });
      alert("Transaction sent! You'll receive MET shortly.");
      await fetchMETBalance();
    } catch (err) {
      console.error("Transaction failed", err);
      alert("Transaction failed.");
    }
  });
}
