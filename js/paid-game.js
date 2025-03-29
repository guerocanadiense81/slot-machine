const API_URL = 'https://slot-machine-a08c.onrender.com';

document.addEventListener("DOMContentLoaded", function () {
  let credits = 0;
  let currentBet = 0;
  let winPercentage = 30;
  let latestBNBPrice = 0;

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

  const payouts = {
    "ch": 50,
    "s7": 10,
    "sc": 5,
    "b3": 4,
    "b2": 3,
    "b1": 2
  };

  const balanceDisplay = document.getElementById("metBalance");
  const totalCreditsDisplay = document.getElementById("totalCredits");
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

  let web3;
  let tokenContract;
  let walletAddress;

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
    balanceDisplay.textContent = `${credits.toFixed(2)} MET`;
    totalCreditsDisplay.textContent = `Credits: ${credits.toFixed(2)}`;
  }

  // Fetch win % on load
  fetch(`${API_URL}/api/get-win-percentages`)
    .then(res => res.json())
    .then(data => {
      winPercentage = parseInt(data.paid) || 30;
    });

  connectWalletBtn.addEventListener("click", initWeb3);

  betButtons.forEach((button, index) => {
    const betValues = [1, 5, 10, 50, 100, 1000];
    button.addEventListener("click", () => {
      currentBet = betValues[index];
    });
  });

  spinBtn.addEventListener("click", async () => {
    if (!walletAddress) return alert("Please connect your wallet first.");
    if (credits < currentBet || currentBet <= 0) {
      alert("Insufficient MET or no bet selected.");
      return;
    }

    credits -= currentBet;
    updateCreditsDisplay();

    const result = [];
    const symbols = ["b1.png", "b2.png", "b3.png", "ch.png", "s7.png", "sc.png"];

    reels.forEach((reel, idx) => {
      setTimeout(() => {
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        reel.src = `/assets/${symbol}`;
        result[idx] = symbol;
      }, idx * 200);
    });

    setTimeout(async () => {
      const symbol = result[0];
      const isWin = result.every(s => s === symbol);
      if (isWin) {
        const payout = payouts[symbol.replace(".png", "")] || 1;
        const winAmount = currentBet * payout * (winPercentage / 100);
        credits += winAmount;
        updateCreditsDisplay();

        await fetch(`${API_URL}/api/settle-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, credits: winAmount })
        });
      } else {
        await fetch(`${API_URL}/api/record-loss`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress, amount: currentBet })
        });
      }
      fetchMETBalance();
    }, 1000);
  });

  cashOutBtn.addEventListener("click", async () => {
    if (!walletAddress || credits <= 0) return alert("No credits to cash out.");
    fetch(`${API_URL}/api/settle-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress, credits })
    })
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          alert("Cashed out!");
          fetchMETBalance();
        } else {
          alert("Cash out failed.");
        }
      });
  });

  calculateBtn.addEventListener("click", async () => {
    const usdVal = parseFloat(usdInput.value) || 0;
    const bnbVal = parseFloat(bnbInput.value) || 0;

    const res = await fetch(`${API_URL}/api/get-bnb-price`);
    const data = await res.json();
    latestBNBPrice = data.bnbPrice;

    let usdAmount, bnbAmount;

    if (usdVal > 0) {
      usdAmount = usdVal;
      bnbAmount = usdVal / latestBNBPrice;
    } else if (bnbVal > 0) {
      bnbAmount = bnbVal;
      usdAmount = bnbVal * latestBNBPrice;
    } else {
      alert("Enter a valid USD or BNB value.");
      return;
    }

    const metTokens = usdAmount;
    outputLabel.textContent = `You'll get ${metTokens.toFixed(2)} MET\n= ${bnbAmount.toFixed(4)} BNB\n= $${usdAmount.toFixed(2)}`;
    buyBtn.setAttribute("data-bnb", bnbAmount);
    buyBtn.setAttribute("data-met", metTokens);
  });

  buyBtn.addEventListener("click", async () => {
    if (!walletAddress) return alert("Connect wallet first.");
    const bnbAmount = buyBtn.getAttribute("data-bnb");
    const recipient = "0x073f5CaDb9424Ce0a50a6E567AB87c2Be97D76F6"; // MET wallet

    try {
      await web3.eth.sendTransaction({
        from: walletAddress,
        to: recipient,
        value: web3.utils.toWei(bnbAmount, "ether")
      });
      alert("Transaction sent! You'll receive MET shortly.");
      fetchMETBalance();
    } catch (err) {
      console.error("Buy failed", err);
      alert("Transaction failed.");
    }
  });

  // Auto-init if wallet already connected
  if (window.ethereum && window.ethereum.selectedAddress) {
    initWeb3();
  }
});
