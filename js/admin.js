const API_URL = 'https://slot-machine-a08c.onrender.com';

document.addEventListener("DOMContentLoaded", async () => {
  // Load current win percentage
  const winInput = document.getElementById("winPercentageInput");
  const res = await fetch(`${API_URL}/api/get-win-percentage`);
  const data = await res.json();
  winInput.value = data.percentage;

  // Load paused state and update display
  const pauseStatus = await fetch(`${API_URL}/api/get-paused`).then(res => res.json());
  document.getElementById("pausedStatus").textContent = pauseStatus.paused ? "Paused" : "Active";

  // Load transaction log
  const logDiv = document.getElementById("transactionLog");
  fetch(`${API_URL}/api/transactions`)
    .then(response => response.json())
    .then(data => {
      logDiv.innerHTML = data.transactions.map(tx => `
        <div>
          <strong>${tx.address}</strong> - ${tx.amount} MET - ${tx.status} - ${new Date(tx.date).toLocaleString()}
        </div>
      `).join('');
    });

  // Optionally, load metrics if endpoint is available
  if(document.getElementById("metrics")){
    const metricsRes = await fetch(`${API_URL}/api/metrics`);
    const metricsData = await metricsRes.json();
    document.getElementById("metrics").innerHTML = `
      <p>Total Purchased: ${metricsData.totalBought} MET</p>
      <p>Total Wins: ${metricsData.totalWins} MET</p>
      <p>Total Losses: ${metricsData.totalLosses} MET</p>
      <p>Net Settled: ${metricsData.totalSettled} MET</p>
    `;
  }
});

async function updateWinPercentage() {
  const percentage = parseInt(document.getElementById("winPercentageInput").value);
  if (isNaN(percentage) || percentage < 0 || percentage > 100) {
    alert("Please enter a valid percentage between 0 and 100");
    return;
  }
  const res = await fetch(`${API_URL}/api/set-win-percentage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ percentage })
  });
  const data = await res.json();
  if (data.success) {
    alert("Win percentage updated!");
  }
}

async function pauseGame() {
  const res = await fetch(`${API_URL}/api/pause`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  const data = await res.json();
  if (data.success) {
    alert("Game paused");
    document.getElementById("pausedStatus").textContent = "Paused";
  }
}

async function unpauseGame() {
  const res = await fetch(`${API_URL}/api/unpause`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  const data = await res.json();
  if (data.success) {
    alert("Game unpaused");
    document.getElementById("pausedStatus").textContent = "Active";
  }
}

async function updateHouseWallet() {
  const newHouseWallet = document.getElementById("newHouseWallet").value;
  if (!newHouseWallet) {
    alert("Please enter a new house wallet address.");
    return;
  }
  const res = await fetch(`${API_URL}/api/update-house-wallet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newHouseWallet })
  });
  const data = await res.json();
  if (data.success) {
    alert("House wallet updated!");
  } else {
    alert("Failed to update house wallet.");
  }
}

async function clearTransactions() {
  const res = await fetch(`${API_URL}/api/clear-transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  const data = await res.json();
  if (data.success) {
    alert("Transaction log cleared.");
    document.getElementById("transactionLog").innerHTML = "";
  } else {
    alert("Failed to clear transaction log.");
  }
}

function downloadCSV() {
  window.location.href = `${API_URL}/api/download-transactions`;
}

// Function to refresh live MET balance for a given wallet address (for admin metrics)
async function refreshMetrics() {
  const walletAddress = document.getElementById("metricsWallet").value;
  if (!walletAddress) {
    alert("Please enter a wallet address to check metrics.");
    return;
  }
  // Minimal ABI for balanceOf
  const tokenABI = [
    {
      "constant": true,
      "inputs": [{ "name": "_owner", "type": "address" }],
      "name": "balanceOf",
      "outputs": [{ "name": "balance", "type": "uint256" }],
      "type": "function"
    }
  ];
  // Replace with your MET token contract address
  const tokenAddress = "0xCFa63A2B76120dda8992Ac9cc5A8Ba7079b0bd29";
  let web3;
  if(window.ethereum){
    web3 = new Web3(window.ethereum);
  } else {
    // Fall back to a public RPC if needed
    web3 = new Web3("https://bsc-dataseed.binance.org/");
  }
  try {
    const tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
    const balanceWei = await tokenContract.methods.balanceOf(walletAddress).call();
    const balance = web3.utils.fromWei(balanceWei, "ether");
    document.getElementById("walletMetrics").innerText = `MET Balance: ${balance}`;
  } catch (error) {
    console.error("Error fetching wallet metrics:", error);
    alert("Error fetching wallet metrics");
  }
}

// Logout function
function logout() {
  localStorage.removeItem("adminToken");
  window.location.href = "/admin-login.html";
}
