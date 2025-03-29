const API_URL = 'https://slot-machine-a08c.onrender.com';

document.addEventListener("DOMContentLoaded", function () {
  let credits = 0;
  let currentBet = 0;
  let winPercentage = 30;

  const balanceDisplay = document.getElementById("metBalance");
  const spinBtn = document.getElementById("spinBtn");
  const betButtons = document.querySelectorAll(".bet");
  const reels = document.querySelectorAll(".reel img");
  const connectWalletBtn = document.getElementById("connectWallet");
  const cashOutBtn = document.getElementById("cashOutBtn");

  const tokenAddress = "0xb80b92Be7402E1e2D3189fff261D672D8104b322"; // Upgradeable contract
  const tokenABI = [
    {
      "constant": true,
      "inputs": [{ "name": "_owner", "type": "address" }],
      "name": "balanceOf",
      "outputs": [{ "name": "balance", "type": "uint256" }],
      "type": "function"
    }
  ];

  let web3;
  if (window.ethereum) {
    web3 = new Web3(window.ethereum);
  } else {
    alert("Please install MetaMask.");
  }

  async function fetchMETBalance() {
    try {
      const accounts = await web3.eth.getAccounts();
      const tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
      const balanceWei = await tokenContract.methods.balanceOf(accounts[0]).call();
      credits = parseFloat(web3.utils.fromWei(balanceWei, "ether"));
      updateBalance();
      spinBtn.disabled = false;
    } catch (err) {
      console.error("Error fetching balance:", err);
    }
  }

  function updateBalance() {
    balanceDisplay.textContent = `${credits.toFixed(2)} MET`;
  }

  fetch(`${API_URL}/api/get-win-percentages`)
    .then(res => res.json())
    .then(data => winPercentage = data.paid || 30);

  if (connectWalletBtn) {
    connectWalletBtn.addEventListener("click", async () => {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      fetchMETBalance();
    });
  }

  const payouts = {
    "ch": 50,
    "s7": 10,
    "sc": 5,
    "b3": 4,
    "b2": 3,
    "b1": 2
  };

  betButtons.forEach((button, index) => {
    const betValues = [1, 5, 10, 50, 100, 1000];
    button.addEventListener("click", () => {
      currentBet = betValues[index];
      console.log(`Bet: ${currentBet} MET`);
    });
  });

  async function spinReels() {
    if (credits < currentBet || currentBet <= 0) {
      alert("Not enough MET or no bet selected!");
      return;
    }

    const accounts = await web3.eth.getAccounts();
    const player = accounts[0];

    credits -= currentBet;
    updateBalance();

    const result = [];
    const symbolFiles = ["b1.png", "b2.png", "b3.png", "ch.png", "s7.png", "sc.png"];

    reels.forEach((reel, idx) => {
      setTimeout(() => {
        let symbol = symbolFiles[Math.floor(Math.random() * symbolFiles.length)];
        reel.src = `/assets/${symbol}`;
        result[idx] = symbol;
      }, idx * 200);
    });

    setTimeout(async () => {
      if (result[0] === result[1] && result[1] === result[2]) {
        const basePayout = payouts[result[0]] || 1;
        const winAmount = currentBet * basePayout * (winPercentage / 100);
        credits += winAmount;
        updateBalance();

        await fetch(`${API_URL}/api/settle-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: player, credits: winAmount })
        });
      } else {
        await fetch(`${API_URL}/api/record-loss`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: player, amount: currentBet })
        });
      }
      fetchMETBalance();
    }, 1000);
  }

  spinBtn.addEventListener("click", spinReels);

  if (cashOutBtn) {
    cashOutBtn.addEventListener("click", async () => {
      const accounts = await web3.eth.getAccounts();
      const player = accounts[0];
      const data = JSON.stringify({ walletAddress: player, credits });

      fetch(`${API_URL}/api/settle-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: data
      })
        .then(res => res.json())
        .then(res => {
          if (res.success) {
            alert("Session settled!");
            fetchMETBalance();
          } else {
            alert("Cash out failed.");
          }
        });
    });
  }

  // --- Buy MET Feature ---
  const usdInput = document.getElementById("usdAmount");
  const calculateBtn = document.getElementById("calculateMetBtn");
  const buyBtn = document.getElementById("buyNowBtn");
  const outputLabel = document.getElementById("metEstimate");

  calculateBtn.addEventListener("click", async () => {
    const usdAmount = parseFloat(usdInput.value);
    if (!usdAmount || usdAmount <= 0) {
      alert("Enter valid USD amount.");
      return;
    }

    const res = await fetch(`${API_URL}/api/get-bnb-price`);
    const data = await res.json();
    const bnbPrice = data.bnbPrice;
    const requiredBNB = usdAmount / bnbPrice;
    const metTokens = usdAmount;

    outputLabel.textContent = `Buy ${metTokens} MET = ${requiredBNB.toFixed(4)} BNB ($${usdAmount})`;
    buyBtn.setAttribute("data-bnb", requiredBNB);
    buyBtn.setAttribute("data-met", metTokens);
  });

  buyBtn.addEventListener("click", async () => {
    const accounts = await web3.eth.getAccounts();
    const buyer = accounts[0];
    const bnbAmount = buyBtn.getAttribute("data-bnb");
    const metAmount = buyBtn.getAttribute("data-met");

    try {
      await web3.eth.sendTransaction({
        from: buyer,
        to: "0x073f5CaDb9424Ce0a50a6E567AB87c2Be97D76F6",
        value: web3.utils.toWei(bnbAmount, "ether")
      });

      // Notify backend of purchase
      await fetch(`${API_URL}/api/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: buyer, usdAmount: metAmount })
      });

      alert("Transaction sent! You'll receive your MET soon.");
    } catch (err) {
      console.error("Purchase failed", err);
      alert("Transaction failed.");
    }
  });

  updateBalance();
});
