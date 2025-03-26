document.addEventListener("DOMContentLoaded", function () {
  async function connectWallet() {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        document.getElementById("walletAddress").textContent = `Wallet: ${accounts[0]}`;
      } catch (error) {
        console.error("Wallet connection failed", error);
      }
    } else {
      alert("Please install MetaMask.");
    }
  }
  document.getElementById("connectWallet").addEventListener("click", connectWallet);
});
