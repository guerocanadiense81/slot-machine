// /js/wallet.js
const API_URL = 'https://slot-machine-a08c.onrender.com';

window.addEventListener("load", async () => {
  if (typeof window.ethereum !== "undefined") {
    const connectBtn = document.getElementById("connectWallet");

    connectBtn.addEventListener("click", async () => {
      try {
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const web3 = new Web3(window.ethereum);
        const accounts = await web3.eth.getAccounts();
        document.getElementById("walletAddress").innerText = `Wallet: ${accounts[0]}`;
      } catch (err) {
        console.error("Wallet connection failed", err);
      }
    });
  } else {
    alert("Please install MetaMask!");
  }
});
