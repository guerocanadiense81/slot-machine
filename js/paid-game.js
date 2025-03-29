const API_URL = 'https://slot-machine-a08c.onrender.com';

let web3;
let tokenContract;
let walletAddress = '';
let credits = 0;
let currentBet = 0;
let winPercentage = 30;

const tokenAddress = "0xb80b92Be7402E1e2D3189fff261D672D8104b322";
const tokenABI = [
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "type": "function"
  }
];

document.addEventListener("DOMContentLoaded", async () => {
  // UI Elements
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

  const payouts = {
    "ch": 50,
    "s7": 10,
    "sc": 5,
    "b3": 4,
    "b2": 3,
    "b1": 2
  };

  // Initialize Web3
  async function initWeb3() {
    if (window.ethereum) {
      web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.requestAccounts();
      walletAddress = accounts[0];
      tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
      document.getElementById("walletAddress")?.innerText = `Wallet: ${walletAddress}`;
      await fetchMETBalance();
    } else {
      alert("MetaMask is required.");
    }
  }

  // Fetch balance
  async function fetchMETBalance() {
    try {
      const balanceWei = await tokenContract.methods.balanceOf(walletAddress).call();
      credits = parseFloat(web3.utils.fromWei(balanceWei, "ether"));
      updateCreditsDisplay();
      spinBtn.disabled = false;
    } catch (err) {
      console.error("Failed to fetch MET balance", err);
    }
  }

  function updateCreditsDisplay() {
    document.getElementById("metBalance").innerText = `${credits.toFixed(2)} MET`;
    document.getElementById("totalCredits").innerText = `Credits: ${credits.toFixed(2)}`;
  }

  connectWalletBtn?.addEventListener("click", initWeb3);

  // Get Win Percentage
  fetch(`${API_URL}/api/get-win-percentages`)
    .then(res => res.json())
    .then(data => winPercentage = data.paid)
    .catch(err => console.error("Failed to fetch win %", err));

  // Bet Buttons
  const betValues = [1, 5, 10, 50, 100, 1000];
  betButtons.forEach((button, i) => {
    button.addEventListener("click", () => {
      currentBet = betValues[i];
      console.log(`Selected bet: ${currentBet} MET`);
    });
  });

  // SPIN Function
  spinBtn.addEventListener("click", async () => {
    if (credits < currentBet || currentBet <= 0) {
      alert("Insufficient credits or no bet selected.");
      return;
    }

    credits -= currentBet;
    updateCreditsDisplay();

    const result = [];
    const symbols = ["b1.png", "b2.png", "b3.png", "ch.png", "s7.png", "sc.png"];

    reels.forEach((reel, i) => {
      setTimeout(() => {
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        reel.src = `/assets/${symbol}`;
        result[i] = symbol;
      }, i * 200);
    });

    setTimeout(async () => {
      const allSame = result[0] === result[1] && result[1] === result[2];

      if (allSame) {
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

      fetchMETBalance();
    }, 1000);
  });

  // CASH OUT
  cashOutBtn?.addEventListener("click", async () => {
    const data = { walletAddress, credits };

    fetch(`${API_URL}/api/settle-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          alert("Cash out complete.");
          fetchMETBalance();
        } else {
          alert("Cash out failed.");
        }
      });
  });

  // --- BUY MET TOKENS ---
  let latestBNBPrice = 0;

  calculateBtn.addEventListener("click", async () => {
    const usdVal = parseFloat(usdInput.value);
    const bnbVal = parseFloat(bnbInput.value);

    try {
      const res = await fetch(`${API_URL}/api/get-bnb-price`);
      const data = await res.json();
      latestBNBPrice = data.bnbPrice;

      let usdAmount, bnbAmount;

      if (usdVal > 0) {
        usdAmount = usdVal;
        bnbAmount = usdAmount / latestBNBPrice;
      } else if (bnbVal > 0) {
        bnbAmount = bnbVal;
        usdAmount = bnbVal * latestBNBPrice;
      } else {
        alert("Enter a valid USD or BNB value.");
        return;
      }

      const metTokens = usdAmount;
      outputLabel.textContent = `You'll get ${metTokens.toFixed(2)} MET\n= ${bnbAmount.toFixed(4)} BNB\n= $${usdAmount.toFixed(2)}`;
      buyBtn.setAttribute("data-bnb", bnbAmount.toString());
      buyBtn.setAttribute("data-met", metTokens.toString());
    } catch (err) {
      console.error("Error fetching BNB price:", err);
    }
  });

  buyBtn.addEventListener("click", async () => {
    const accounts = await web3.eth.getAccounts();
    const buyer = accounts[0];
    const bnbAmount = buyBtn.getAttribute("data-bnb");

    try {
      await web3.eth.sendTransaction({
        from: buyer,
        to: "0x073f5CaDb9424Ce0a50a6E567AB87c2Be97D76F6", // MET wallet
        value: web3.utils.toWei(bnbAmount, "ether")
      });
      alert("Transaction sent. MET will arrive shortly.");
      fetchMETBalance();
    } catch (err) {
      console.error("Purchase error:", err);
      alert("Transaction failed.");
    }
  });
});
