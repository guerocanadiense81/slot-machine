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

  const tokenAddress = "0xb80b92Be7402E1e2D3189fff261D672D8104b322";
  const tokenABI = [{
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "type": "function"
  }];

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
    document.getElementById("totalCredits").innerText = `Credits: ${credits.toFixed(2)}`;
  }

  fetch(`${API_URL}/api/get-win-percentages`)
    .then(res => res.json())
    .then(data => winPercentage = data.paid);

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
          body: JSON.stringify({ walletAddress: player, credits: winAmount }),
        });
      } else {
        await fetch(`${API_URL}/api/record-loss`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: player, amount: currentBet }),
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

  // BUY SECTION — updated to support USD or BNB input
  const usdInput = document.getElementById("usdAmount");
  const bnbInput = document.getElementById("bnbAmount");
  const calculateBtn = document.getElementById("calculateMetBtn");
  const buyBtn = document.getElementById("buyNowBtn");
  const outputLabel = document.getElementById("metEstimate");

  calculateBtn.addEventListener("click", async () => {
    const usdVal = parseFloat(usdInput.value);
    const bnbVal = parseFloat(bnbInput.value);

    if (!usdVal && !bnbVal) {
      alert("Enter either USD or BNB.");
      return;
    }

    const res = await fetch(`${API_URL}/api/get-bnb-price`);
    const { bnbPrice } = await res.json();

    let usdAmount = 0;
    let bnbAmount = 0;
    let metTokens = 0;

    if (usdVal) {
      usdAmount = usdVal;
      bnbAmount = usdAmount / bnbPrice;
      metTokens = usdAmount;
      bnbInput.value = ""; // Clear opposite field
    } else if (bnbVal) {
      bnbAmount = bnbVal;
      usdAmount = bnbAmount * bnbPrice;
      metTokens = usdAmount;
      usdInput.value = ""; // Clear opposite field
    }

    outputLabel.textContent = `You'll receive:\n${metTokens.toFixed(2)} MET\n${bnbAmount.toFixed(4)} BNB\n$${usdAmount.toFixed(2)}`;
    buyBtn.setAttribute("data-bnb", bnbAmount);
    buyBtn.setAttribute("data-met", metTokens);
  });

  buyBtn.addEventListener("click", async () => {
    const bnbAmount = buyBtn.getAttribute("data-bnb");

    if (!bnbAmount || parseFloat(bnbAmount) <= 0) {
      alert("Missing BNB amount. Please calculate first.");
      return;
    }

    const accounts = await web3.eth.getAccounts();
    const buyer = accounts[0];

    try {
      await web3.eth.sendTransaction({
        from: buyer,
        to: "0x073f5CaDb9424Ce0a50a6E567AB87c2Be97D76F6",
        value: web3.utils.toWei(bnbAmount, "ether")
      });

      alert("Transaction sent! You'll receive MET soon.");
      fetchMETBalance();
    } catch (err) {
      console.error("Transaction failed", err);
      alert("Purchase failed. Please try again.");
    }
  });

  updateBalance();
});
