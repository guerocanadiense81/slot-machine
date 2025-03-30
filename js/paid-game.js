const API_URL = 'https://slot-machine-a08c.onrender.com';

let web3;
let walletAddress = '';
let credits = 0;
let currentBet = 0;

const payouts = {
  "seven": 150,
  "coins1": 100,
  "chest": 50,
  "crown": 20,
  "bell": 10,
  "key": 5,
  "goldbar": 2
};

const symbols = Object.keys(payouts);

document.addEventListener("DOMContentLoaded", async () => {
  const spinBtn = document.getElementById("spinBtn");
  const betButtons = document.querySelectorAll(".bet");
  const reels = document.querySelectorAll(".reel img");
  const connectWalletBtn = document.getElementById("connectWallet");
  const metBalanceEl = document.getElementById("metBalance");
  const totalCreditsDisplay = document.getElementById("totalCredits");
  const usdInput = document.getElementById("usdAmount");
  const bnbInput = document.getElementById("bnbAmount");
  const calculateBtn = document.getElementById("calculateMetBtn");
  const buyBtn = document.getElementById("buyNowBtn");
  const outputLabel = document.getElementById("metEstimate");

  const updateCreditsUI = () => {
    totalCreditsDisplay.textContent = `Credits: ${credits.toFixed(2)}`;
    metBalanceEl.textContent = `${credits.toFixed(2)} MET`;
  };

  async function initWallet() {
    if (window.ethereum) {
      web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.requestAccounts();
      walletAddress = accounts[0];
      connectWalletBtn.textContent = walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4);
      await fetchBalance();
    } else {
      alert("Please install MetaMask");
    }
  }

  async function fetchBalance() {
    try {
      const res = await fetch(`${API_URL}/api/balance/${walletAddress}`);
      const data = await res.json();
      credits = parseFloat(data.balance || 0);
      updateCreditsUI();
    } catch (err) {
      console.error("Fetch credits failed:", err);
    }
  }

  betButtons.forEach((button, idx) => {
    const amounts = [1, 5, 10, 25, 50, 100];
    button.addEventListener("click", () => {
      currentBet = amounts[idx];
      console.log("Bet set:", currentBet);
    });
  });

  function animateReels() {
    reels.forEach((reel) => {
      reel.classList.add("spinning");
      setTimeout(() => reel.classList.remove("spinning"), 500);
    });
  }

  async function spin() {
    if (!walletAddress || currentBet <= 0 || credits < currentBet) {
      alert("Connect wallet and ensure sufficient credits.");
      return;
    }

    animateReels();
    spinBtn.disabled = true;

    try {
      const res = await fetch(`${API_URL}/api/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress, bet: currentBet })
      });

      const data = await res.json();
      const result = data.result; // e.g. ["bell", "bell", "goldbar"]
      credits = data.updatedBalance;

      reels.forEach((reel, idx) => {
        reel.src = `/assets/${result[idx]}.png`;
      });

      updateCreditsUI();

      if (data.won) {
        alert(`🎉 You won ${data.winAmount.toFixed(2)} MET!`);
      }

    } catch (err) {
      console.error("Spin failed:", err);
      alert("Spin error");
    }

    spinBtn.disabled = false;
  }

  async function handleBuy() {
    const usdVal = parseFloat(usdInput.value);
    const bnbVal = parseFloat(bnbInput.value);
    let usdAmount, bnbAmount;

    try {
      const priceRes = await fetch(`${API_URL}/api/get-bnb-price`);
      const { bnbPrice } = await priceRes.json();

      if (usdVal > 0) {
        usdAmount = usdVal;
        bnbAmount = usdVal / bnbPrice;
      } else if (bnbVal > 0) {
        bnbAmount = bnbVal;
        usdAmount = bnbVal * bnbPrice;
      } else {
        alert("Enter valid USD or BNB");
        return;
      }

      const metAmount = usdAmount;

      outputLabel.textContent = `You'll get ${metAmount} MET = ${bnbAmount.toFixed(4)} BNB = $${usdAmount.toFixed(2)}`;
      buyBtn.setAttribute("data-usd", usdAmount);
      buyBtn.setAttribute("data-bnb", bnbAmount.toFixed(6));

    } catch (err) {
      console.error("Conversion error:", err);
      outputLabel.textContent = "Failed to get BNB price.";
    }
  }

  async function confirmBuy() {
    const usdAmount = parseFloat(buyBtn.getAttribute("data-usd"));
    const bnbAmount = buyBtn.getAttribute("data-bnb");

    if (!walletAddress || !bnbAmount) return;

    try {
      await web3.eth.sendTransaction({
        from: walletAddress,
        to: "0x073f5CaDb9424Ce0a50a6E567AB87c2Be97D76F6",
        value: web3.utils.toWei(bnbAmount, "ether")
      });

      alert("BNB sent. MET arriving soon...");

      await fetch(`${API_URL}/api/confirm-purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyer: walletAddress, usdAmount })
      });

      await fetchBalance();
    } catch (err) {
      console.error("Purchase failed", err);
      alert("Transaction error");
    }
  }

  connectWalletBtn.addEventListener("click", initWallet);
  spinBtn.addEventListener("click", spin);
  calculateBtn?.addEventListener("click", handleBuy);
  buyBtn?.addEventListener("click", confirmBuy);

  await fetchBalance();
});
