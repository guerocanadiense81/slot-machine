window.addEventListener("load", async () => {
  if (typeof window.ethereum !== "undefined") {
    const connectBtn = document.getElementById("connectWallet");

    connectBtn?.addEventListener("click", async () => {
      try {
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        document.getElementById("walletAddress").innerText = `Wallet: ${accounts[0]}`;
      } catch (err) {
        console.error("Wallet connection failed", err);
      }
    });
  } else {
    alert("Please install MetaMask!");
  }
});
