const API_URL = 'https://slot-machine-a08c.onrender.com';

window.addEventListener("DOMContentLoaded", async () => {
  const connectBtn = document.getElementById("connectWallet");
  const walletAddressLabel = document.getElementById("walletAddress");

  if (!window.ethereum) {
    alert("MetaMask is required.");
    return;
  }

  const web3 = new Web3(window.ethereum);

  connectBtn?.addEventListener("click", async () => {
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const userAddress = accounts[0];
      if (walletAddressLabel) {
        walletAddressLabel.innerText = `Wallet: ${userAddress}`;
      }
    } catch (error) {
      console.error("Wallet connection failed:", error);
    }
  });
});
