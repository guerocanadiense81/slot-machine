// public/wallet.js
document.addEventListener("DOMContentLoaded", async () => {
  async function connectWalletAndLoadBalance() {
    console.log("Connect wallet button clicked");
    
    if (!window.ethereum) {
      alert("Please install MetaMask to play the paid version.");
      return;
    }
    try {
      console.log("Requesting accounts...");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (!accounts || accounts.length === 0) {
        console.error("No accounts returned.");
        return;
      }
      const walletAddress = accounts[0];
      console.log("Connected wallet:", walletAddress);
      window.userWallet = walletAddress; // Save globally for further use

      // Fetch the user's in-game balance from the backend.
      const response = await fetch(`/api/user/${walletAddress.toLowerCase()}`);
      if (!response.ok) throw new Error("Failed to load balance.");
      const data = await response.json();
      console.log("Fetched balance:", data.balance);
      document.getElementById("credits-display").innerText = data.balance;
    } catch (error) {
      console.error("Error connecting wallet or loading balance:", error);
      alert("Error connecting wallet or loading balance. Check console for details.");
    }
  }

  const connectWalletBtn = document.getElementById("connectWallet");
  if (connectWalletBtn) {
    connectWalletBtn.addEventListener("click", connectWalletAndLoadBalance);
    console.log("connectWallet event listener attached");
  } else {
    console.error("Connect Wallet button not found!");
  }

  // Expose a global function to update the virtual balance
  window.updateInGameBalance = async function(newBalance) {
    if (!window.userWallet) {
      alert("Wallet not connected.");
      return;
    }
    try {
      const response = await fetch(`/api/user/${window.userWallet.toLowerCase()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balance: newBalance })
      });
      const result = await response.json();
      console.log("Balance updated:", result);
      document.getElementById("credits-display").innerText = result.newBalance;
    } catch (error) {
      console.error("Error updating in-game balance:", error);
    }
  }
});
