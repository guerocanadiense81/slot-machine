// public/wallet.js

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded; initializing wallet connection...");
  window.offchainBalance = 0;
  window.initialDeposit = 0;

  async function connectWalletAndLoadBalances() {
    console.log("Connect Wallet button clicked.");
    if (!window.ethereum) {
      alert("MetaMask not detected. Please install MetaMask.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (!accounts || !accounts.length) return;
      const walletAddress = accounts[0];
      console.log("Connected wallet:", walletAddress);
      window.userWallet = walletAddress;
      alert("Wallet connected: " + walletAddress);
      
      // Fetch off-chain balance (includes deposit and net play balance)
      const response = await fetch(`/api/user/${walletAddress.toLowerCase()}`);
      const data = await response.json();
      console.log("Fetched off-chain balance:", data);
      const creditsDisplay = document.getElementById("credits-display");
      if (creditsDisplay) creditsDisplay.innerText = data.total;
      // For gameplay, store only the net win/loss portion.
      window.offchainBalance = parseFloat(data.balance) || 0;
      // Record the initial deposit separately.
      window.initialDeposit = parseFloat(data.deposit) || 0;
      
      // Fetch on-chain MET balance for display.
      await getOnChainMETBalance();
    } catch (error) {
      console.error("Error connecting wallet:", error);
      alert("Error connecting wallet. Check console for details.");
    }
  }

  async function getOnChainMETBalance() {
    if (!window.ethereum) return;
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const walletAddress = await signer.getAddress();
      const MET_ABI = ["function balanceOf(address owner) view returns (uint256)"];
      const MET_CONTRACT_ADDRESS = "0xb80b92Be7402E1e2D3189fff261D672D8104b322";
      const metContract = new ethers.Contract(MET_CONTRACT_ADDRESS, MET_ABI, provider);
      const balanceBN = await metContract.balanceOf(walletAddress);
      const formattedBalance = ethers.utils.formatUnits(balanceBN, 18);
      const onChainBalanceElement = document.getElementById("metOnChainBalance");
      if (onChainBalanceElement) onChainBalanceElement.innerText = formattedBalance;
    } catch (error) {
      console.error("Error fetching on-chain MET balance:", error);
    }
  }

  const connectWalletBtn = document.getElementById("connectWallet");
  if (connectWalletBtn) {
    connectWalletBtn.addEventListener("click", connectWalletAndLoadBalances);
    console.log("connectWallet event listener attached.");
  } else {
    console.error("Connect Wallet button not found in DOM.");
  }

  // Function to update off-chain balance via gameplay delta.
  window.updateInGameBalance = async function(delta) {
    if (!window.userWallet) {
      alert("Wallet not connected.");
      return;
    }
    try {
      const response = await fetch(`/api/balance-change/${window.userWallet.toLowerCase()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: delta })
      });
      const result = await response.json();
      console.log("Off-chain balance updated on backend:", result);
      // Update the display (total = deposit + balance)
      const deposit = parseFloat(result.deposit || "0");
      const balance = parseFloat(result.newBalance || "0");
      const total = deposit + balance;
      const creditsDisplay = document.getElementById("credits-display");
      if (creditsDisplay) creditsDisplay.innerText = total.toString();
      // Update the net play balance
      window.offchainBalance = balance;
      return result.newBalance;
    } catch (error) {
      console.error("Error updating off-chain balance:", error);
    }
  };

  // Manual deposit: calls deposit-offchain endpoint.
  window.manualDeposit = async function() {
    const depositInput = document.getElementById("depositInput");
    let amount = parseFloat(depositInput.value);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid deposit amount.");
      return;
    }
    try {
      const response = await fetch(`/api/deposit-offchain/${window.userWallet.toLowerCase()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amount })
      });
      const result = await response.json();
      console.log("Deposit recorded:", result);
      alert(result.message);
      // After deposit, refresh the user's display.
      const userResponse = await fetch(`/api/user/${window.userWallet.toLowerCase()}`);
      const userData = await userResponse.json();
      const total = parseFloat(userData.deposit || "0") + parseFloat(userData.balance || "0");
      const creditsDisplay = document.getElementById("credits-display");
      if (creditsDisplay) creditsDisplay.innerText = total.toString();
      window.initialDeposit = parseFloat(userData.deposit) || 0;
    } catch (error) {
      console.error("Error during manual deposit:", error);
    }
  };

  // Reconcile session: calls /api/player/reconcile.
  // It uses the locked deposit and the net off-chain balance.
  window.reconcileSession = async function() {
    if (!window.userWallet) {
      alert("Wallet not connected.");
      return;
    }
    try {
      const payload = {
        wallet: window.userWallet,
        initialDeposit: window.initialDeposit,
        finalBalance: window.offchainBalance
      };
      const response = await fetch("/api/player/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      alert("Session reconciled. " + data.message + "\nTX Hash: " + data.txHash);
    } catch (error) {
      console.error("Error during session reconciliation:", error);
      alert("Error during reconciliation. Check console for details.");
    }
  };

  window.addEventListener("beforeunload", () => {
    if (window.userWallet) {
      const payload = JSON.stringify({
        wallet: window.userWallet,
        initialDeposit: window.initialDeposit,
        finalBalance: window.offchainBalance
      });
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/player/reconcile", blob);
    }
  });
});
