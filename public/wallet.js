// public/wallet.js

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded; initializing wallet connection...");

  // Global variables to store the player's off-chain balance and session initial deposit.
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
      // Record the initial deposit for this session.
      window.initialDeposit = window.offchainBalance;
      
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

  // Attach wallet connection handler.
  const connectWalletBtn = document.getElementById("connectWallet");
  if (connectWalletBtn) {
    connectWalletBtn.addEventListener("click", connectWalletAndLoadBalances);
    console.log("connectWallet event listener attached.");
  } else {
    console.error("Connect Wallet button not found in DOM.");
  }

  // Global function: update the player's off-chain balance by a relative change.
  window.updateInGameBalance = async function(balanceChange) {
    if (!window.userWallet) {
      alert("Wallet not connected.");
      return;
    }
    try {
      const response = await fetch(`/api/user/${window.userWallet.toLowerCase()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balanceChange: balanceChange })
      });
      const result = await response.json();
      console.log("Off-chain balance updated on backend:", result);
      const creditsDisplay = document.getElementById("credits-display");
      if (creditsDisplay) creditsDisplay.innerText = result.newBalance;
      window.offchainBalance = parseFloat(result.newBalance);
      return result.newBalance;
    } catch (error) {
      console.error("Error updating off-chain balance:", error);
    }
  };

  // Manual deposit: adds deposit amount to off-chain balance.
  window.manualDeposit = async function() {
    const depositInput = document.getElementById("depositInput");
    let depositAmount = parseFloat(depositInput.value);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      alert("Please enter a valid deposit amount.");
      return;
    }
    console.log("Depositing MET. Current balance:", window.offchainBalance, "Deposit amount:", depositAmount);
    await window.updateInGameBalance(depositAmount);
    alert("Deposit successful! New off-chain balance: " + window.offchainBalance + " MET");
  };

  // Reconciliation: finishes the session and triggers on-chain settlement.
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

  // Optionally, use navigator.sendBeacon on beforeunload for automatic reconciliation.
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
