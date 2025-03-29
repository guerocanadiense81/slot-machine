const API_URL = 'https://slot-machine-a08c.onrender.com';

window.addEventListener("DOMContentLoaded", async () => {
  if (typeof window.ethereum !== "undefined") {
    const connectBtn = document.getElementById("connectWallet");
    const walletText = document.getElementById("walletAddress");

    connectBtn?.addEventListener("click", async () => {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        if (accounts.length > 0 && walletText) {
          walletText.innerText = `Wallet: ${accounts[0]}`;
        }
      } catch (err) {
        console.error("Wallet connection failed:", err);
        alert("MetaMask connection failed.");
      }
    });
  } else {
    alert("Please install MetaMask!");
  }
});
