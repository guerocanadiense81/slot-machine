document.addEventListener("DOMContentLoaded", function () {
  const API_URL = 'https://slot-machine-a08c.onrender.com'; // Backend URL

  let credits = 0; // Player's MET balance (fetched from the wallet)
  let currentBet = 0;
  let winPercentage = 30; // Default win percentage; updated from backend if needed

  const balanceDisplay = document.getElementById("metBalance");
  const spinBtn = document.getElementById("spinBtn");
  const betButtons = document.querySelectorAll(".bet");
  const reels = document.querySelectorAll(".reel img");

  // Minimal ABI for ERC-20 Token (only the balanceOf function)
  const tokenABI = [
    {
      "constant": true,
      "inputs": [{ "name": "_owner", "type": "address" }],
      "name": "balanceOf",
      "outputs": [{ "name": "balance", "type": "uint256" }],
      "type": "function"
    }
  ];
  // Replace with your actual MET token contract address:
  const tokenAddress = "0xD88AA293D71803d35132daDfc5a83F991f6021c6";

  // Create a Web3 instance using MetaMask's provider
  let web3;
  if (window.ethereum) {
    web3 = new Web3(window.ethereum);
  } else {
    alert("Please install MetaMask!");
  }

  // Function to fetch MET balance from the token contract
  async function fetchMETBalance() {
    try {
      const accounts = await web3.eth.getAccounts();
      if (accounts.length === 0) {
        alert("No wallet connected.");
        return;
      }
      const userAddress = accounts[0];
      const tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
      let balanceWei = await tokenContract.methods.balanceOf(userAddress).call();
      // Assuming MET token uses 18 decimals:
      credits = parseFloat(web3.utils.fromWei(balanceWei, "ether"));
      updateBalance();
    } catch (err) {
      console.error("Error fetching MET balance:", err);
    }
  }

  function updateBalance() {
    balanceDisplay.textContent = credits;
  }

  // Fetch initial win percentage from backend (optional)
  fetch(`${API_URL}/api/get-win-percentage`)
    .then(res => res.json())
    .then(data => winPercentage = data.percentage);

  // Update MET balance after connecting wallet
  async function connectWalletAndFetchBalance() {
    if (window.ethereum) {
      try {
        await window.ethereum.request({ method: "eth_requestAccounts" });
        fetchMETBalance();
      } catch (error) {
        console.error("Error connecting wallet", error);
      }
    }
  }

  // Bind wallet connection button if it exists
  const connectWalletBtn = document.getElementById("connectWallet");
  if (connectWalletBtn) {
    connectWalletBtn.addEventListener("click", connectWalletAndFetchBalance);
  }

  // Bet selection
  betButtons.forEach((button, index) => {
    const betValues = [1, 5, 10, 50, 100, 1000];
    button.addEventListener("click", () => {
      currentBet = betValues[index];
      console.log(`Bet set to ${currentBet} MET`);
    });
  });

  function spinReels() {
    if (credits < currentBet || currentBet <= 0) {
      alert("Not enough MET tokens or no bet selected!");
      return;
    }
    credits -= currentBet;
    updateBalance();

    let result = [];
    const symbolFiles = ["b1.png", "b2.png", "b3.png", "ch.png", "s7.png", "sc.png"];

    reels.forEach((reel, idx) => {
      setTimeout(() => {
        let randomSymbol = symbolFiles[Math.floor(Math.random() * symbolFiles.length)];
        reel.src = `/assets/${randomSymbol}`;
        result[idx] = randomSymbol;
      }, idx * 200);
    });

    setTimeout(() => {
      if (result[0] === result[1] && result[1] === result[2] && Math.random() * 100 < winPercentage) {
        let multiplier = 1;
        if (result[0] === "ch.png") multiplier = 150;
        else if (result[0] === "s7.png") multiplier = 50;
        else if (result[0] === "sc.png") multiplier = 20;
        else if (result[0] === "b3.png") multiplier = 10;
        else if (result[0] === "b2.png") multiplier = 5;
        else if (result[0] === "b1.png") multiplier = 2;
        let winnings = currentBet * multiplier;
        credits += winnings;
      }
      updateBalance();
    }, 1000);
  }

  spinBtn.addEventListener("click", spinReels);

  // Update balance on page load
  updateBalance();
  fetchMETBalance();

  // Cash Out functionality: When the player clicks Cash Out, send settlement data to the backend
  async function cashOut() {
    const accounts = await web3.eth.getAccounts();
    if (!accounts || accounts.length === 0) {
      alert("No wallet connected!");
      return;
    }
    const walletAddress = accounts[0];
    const settlementData = JSON.stringify({ walletAddress, credits });
    fetch(`${API_URL}/api/settle-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: settlementData
    })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          alert("Cash out successful!");
          credits = 0;
          updateBalance();
        } else {
          alert("Cash out failed: " + result.error);
        }
      })
      .catch(err => {
        console.error("Error during cash out:", err);
        alert("Error during cash out.");
      });
  }

  // Bind the cash out button if it exists
  const cashOutBtn = document.getElementById("cashOutBtn");
  if (cashOutBtn) {
    cashOutBtn.addEventListener("click", cashOut);
  }
});
