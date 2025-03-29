window.addEventListener("load", async () => {
  if (typeof window.ethereum !== "undefined") {
    const connectBtn = document.getElementById("connectWallet");

    connectBtn?.addEventListener("click", async () => {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        const wallet = accounts[0];
        document.getElementById("walletAddress")?.innerText = `Wallet: ${wallet}`;
      } catch (err) {
        console.error("Wallet connection failed", err);
      }
    });
  } else {
    alert("Please install MetaMask!");
  }
});
