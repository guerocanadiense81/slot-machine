// public/wallet.js

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded; initializing wallet connection...");
  window.offchainBalance = 0;
  window.initialDeposit = 0;

  async function connectWalletAndLoadBalances() {
    console.log("Connect Wallet button clicked.");
    if (!window.ethereum) {
      alert("MetaMask not detected. Please install MetaMask.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (!accounts || !accounts.length) return;
      const walletAddress = accounts[0];
      console.log("Connected wallet:", walletAddress);
      window.userWallet = walletAddress;
      alert("Wallet connected: " + walletAddress);
      
      // Fetch off-chain balance and deposit from the backend.
      const response = await fetch(`/api/user/${walletAddress.toLowerCase()}`);
      const data = await response.json();
      console.log("Fetched off-chain data:", data);
      const creditsDisplay = document.getElementById("credits-display");
      if (creditsDisplay) creditsDisplay.innerText = data.total; // Display total = deposit + balance.
      window.offchainBalance = parseFloat(data.balance) || 0;
      window.initialDeposit = parseFloat(data.deposit) || 0;
      
      await getOnChainMETBalance();
    } catch (error) {
      console.error("Error connecting wallet:", error);
      alert("Error connecting wallet. Check console for details.");
    }
  }

  async function getOnChainMETBalance() {
    if (!window.ethereum) return;
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const walletAddress = await signer.getAddress();
      const MET_ABI = ["function balanceOf(address owner) view returns (uint256)"];
      const MET_CONTRACT_ADDRESS = "0xb80b92Be7402E1e2D3189fff261D672D8104b322";
      const metContract = new ethers.Contract(MET_CONTRACT_ADDRESS, MET_ABI, provider);
      const balanceBN = await metContract.balanceOf(walletAddress);
      const formattedBalance = ethers.utils.formatUnits(balanceBN, 18);
      const onChainBalanceElement = document.getElementById("metOnChainBalance");
      if (onChainBalanceElement) onChainBalanceElement.innerText = formattedBalance;
    } catch (error) {
      console.error("Error fetching on-chain MET balance:", error);
    }
  }

  const connectWalletBtn = document.getElementById("connectWallet");
  if (connectWalletBtn) {
    connectWalletBtn.addEventListener("click", connectWalletAndLoadBalances);
    console.log("connectWallet event listener attached.");
  } else {
    console.error("Connect Wallet button not found in DOM.");
  }

  // Update the net play balance by sending a delta (win/loss) update.
  window.updateInGameBalance = async function(delta) {
    if (!window.userWallet) {
      alert("Wallet not connected.");
      return;
    }
    try {
      const response = await fetch(`/api/balance-change/${window.userWallet.toLowerCase()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta: delta })
      });
      const result = await response.json();
      console.log("Balance change result:", result);
      // Refresh total displayed: deposit + net balance.
      const res2 = await fetch(`/api/user/${window.userWallet.toLowerCase()}`);
      const data = await res2.json();
      const total = parseFloat(data.deposit) + parseFloat(data.balance);
      const creditsDisplay = document.getElementById("credits-display");
      if (creditsDisplay) creditsDisplay.innerText = total.toString();
      window.offchainBalance = parseFloat(data.balance) || 0;
      return data.balance;
    } catch (error) {
      console.error("Error updating off-chain balance:", error);
    }
  };

  // Manual deposit calls the deposit-offchain endpoint.
  window.manualDeposit = async function() {
    const depositInput = document.getElementById("depositInput");
    let amount = parseFloat(depositInput.value);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid deposit amount.");
      return;
    }
    try {
      const response = await fetch(`/api/deposit-offchain/${window.userWallet.toLowerCase()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amount })
      });
      const result = await response.json();
      console.log("Deposit result:", result);
      alert(result.message);
      // Refresh displayed total funds.
      const res2 = await fetch(`/api/user/${window.userWallet.toLowerCase()}`);
      const data = await res2.json();
      const total = parseFloat(data.deposit) + parseFloat(data.balance);
      const creditsDisplay = document.getElementById("credits-display");
      if (creditsDisplay) creditsDisplay.innerText = total.toString();
      window.initialDeposit = parseFloat(data.deposit) || 0;
    } catch (error) {
      console.error("Error during deposit:", error);
    }
  };

  // Reconcile session: uses the off-chain net play balance only.
  window.reconcileSession = async function() {
    if (!window.userWallet) {
      alert("Wallet not connected.");
      return;
    }
    try {
      const payload = {
        wallet: window.userWallet,
        initialDeposit: window.initialDeposit,
        finalBalance: window.offchainBalance
      };
      const response = await fetch("/api/player/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      alert("Session reconciled. " + data.message + "\nTX Hash: " + data.txHash);
    } catch (error) {
      console.error("Error during reconciliation:", error);
      alert("Error during reconciliation. Check console for details.");
    }
  };

  window.addEventListener("beforeunload", () => {
    if (window.userWallet) {
      const payload = JSON.stringify({
        wallet: window.userWallet,
        initialDeposit: window.initialDeposit,
        finalBalance: window.offchainBalance
      });
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/player/reconcile", blob);
    }
  });
});
