// public/wallet.js
// Make sure ethers.js is loaded in your HTML (e.g., via CDN)

document.addEventListener("DOMContentLoaded", async () => {
  // Connect to MetaMask and retrieve user wallet address and balance
  async function connectWalletAndLoadBalance() {
    if (!window.ethereum) {
      alert("Please install MetaMask to play the paid version.");
      return;
    }
    try {
      // Request account connection
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const walletAddress = accounts[0];
      console.log("Connected wallet:", walletAddress);
      window.userWallet = walletAddress; // save globally for later use

      // Fetch the user's stored virtual balance from your backend
      const response = await fetch(`/api/user/${walletAddress.toLowerCase()}`);
      if (!response.ok) throw new Error("Failed to load balance.");
      const data = await response.json();
      // Update UI element with id "credits-display"
      document.getElementById("credits-display").innerText = data.balance;
    } catch (error) {
      console.error("Error connecting wallet or loading balance:", error);
      alert("Error connecting wallet or loading balance. Check console for details.");
    }
  }

  // Call the connection and load function on page load
  await connectWalletAndLoadBalance();

  // Expose a global function to update the user's in-game balance in the backend
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
      // Update the UI
      document.getElementById("credits-display").innerText = result.newBalance;
    } catch (error) {
      console.error("Error updating in-game balance:", error);
    }
  }
});
