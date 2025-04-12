// public/wallet.js

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded; initializing wallet connection...");

  async function connectWalletAndLoadBalance() {
    console.log("Connect Wallet button clicked.");
    
    if (!window.ethereum) {
      alert("MetaMask not detected. Please install MetaMask.");
      console.error("window.ethereum is undefined.");
      return;
    }
    
    try {
      console.log("Requesting account access...");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      
      if (!accounts || accounts.length === 0) {
        console.error("No accounts returned.");
        return;
      }
      
      const walletAddress = accounts[0];
      console.log("Connected wallet:", walletAddress);
      window.userWallet = walletAddress; // Save wallet for later use
      
      alert("Wallet connected: " + walletAddress);
      
      // Fetch user's virtual in-game balance from the backend API
      const response = await fetch(`/api/user/${walletAddress.toLowerCase()}`);
      if (!response.ok) {
        throw new Error("Failed to load balance from server.");
      }
      
      const data = await response.json();
      console.log("Fetched balance:", data.balance);
      
      // Update the UI element with id "credits-display"
      const creditsDisplay = document.getElementById("credits-display");
      if (creditsDisplay) {
        creditsDisplay.innerText = data.balance;
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      alert("Error connecting wallet. Check console for details.");
    }
  }

  const connectWalletBtn = document.getElementById("connectWallet");
  if (connectWalletBtn) {
    connectWalletBtn.addEventListener("click", connectWalletAndLoadBalance);
    console.log("connectWallet event listener attached.");
  } else {
    console.error("Connect Wallet button not found!");
  }

  // Global function to update the user's in-game balance on the backend.
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
      console.log("Balance updated on backend:", result);
      
      const creditsDisplay = document.getElementById("credits-display");
      if (creditsDisplay) {
        creditsDisplay.innerText = result.newBalance;
      }
    } catch (error) {
      console.error("Error updating in-game balance:", error);
    }
  };
});
