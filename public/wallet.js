// public/wallet.js

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded; initializing wallet connection...");

  // Global variables to store off-chain balance and the initial deposit for the session.
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
      if (!accounts || accounts.length === 0) return;
      const walletAddress = accounts[0];
      console.log("Connected wallet:", walletAddress);
      window.userWallet = walletAddress;
      alert("Wallet connected: " + walletAddress);
      
      // Fetch off-chain balance from backend
      const response = await fetch(`/api/user/${walletAddress.toLowerCase()}`);
      const data = await response.json();
      console.log("Fetched off-chain balance:", data.balance);
      const creditsDisplay = document.getElementById("credits-display");
      if (creditsDisplay) creditsDisplay.innerText = data.balance;
      window.offchainBalance = parseFloat(data.balance) || 0;
      window.initialDeposit = window.offchainBalance;
      
      // Fetch on-chain MET balance (for display)
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
  }

  // Update off-chain balance by relative change
  window.updateInGameBalance = async function(balanceChange) {
    if (!window.userWallet) {
      alert("Wallet not connected.");
      return;
    }
    const response = await fetch(`/api/user/${window.userWallet.toLowerCase()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balanceChange: balanceChange })
    });
    const result = await response.json();
    const creditsDisplay = document.getElementById("credits-display");
    if (creditsDisplay) creditsDisplay.innerText = result.newBalance;
    window.offchainBalance = parseFloat(result.newBalance);
    return result.newBalance;
  };

  // Manual deposit function
  window.manualDeposit = async function() {
    const depositInput = document.getElementById("depositInput");
    let depositAmount = parseFloat(depositInput.value);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      alert("Please enter a valid deposit amount.");
      return;
    }
    await window.updateInGameBalance(depositAmount);
    alert("Deposit successful! New off-chain balance: " + window.offchainBalance + " MET");
  };

  // Reconciliation function for final settlement.
  // Calls the backend /api/player/reconcile endpoint.
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
      alert("Session reconciled. " + data.message + "\nTransaction hash: " + data.txHash);
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
