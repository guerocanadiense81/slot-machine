// Ensure ethers.js is loaded (installed via package.json)
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

  // Cash Out Functionality using ethers.js and CoinGecko API
  window.cashOut = async function(metAmount) {
    // 1 MET = 1 USD; fetch BNB price (USD) from CoinGecko
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd");
    const data = await res.json();
    const bnbPriceUSD = data.binancecoin.usd; // USD per BNB
    // Calculate required BNB amount
    const requiredBNB = metAmount / bnbPriceUSD;

    // Initialize ethers.js
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();

    // Replace 'abi' with your contract's ABI
    const abi = [
      // Minimal ABI for a payable function "buyMET"
      "function buyMET() payable"
    ];
    const contractAddress = "0xb80b92Be7402E1e2D3189fff261D672D8104b322";
    const contract = new ethers.Contract(contractAddress, abi, signer);

    try {
      const tx = await contract.buyMET({
        value: ethers.utils.parseEther(requiredBNB.toString())
      });
      await tx.wait();
      alert("Cash out successful! MET tokens have been sent to your wallet.");
    } catch (error) {
      console.error("Cash out failed", error);
      alert("Cash out failed. Please try again.");
    }
  }
});
