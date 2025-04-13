// public/wallet.js

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded; initializing wallet connection...");
  
  // Defaults for free version when wallet is not available.
  window.offchainBalance = 0;
  window.initialDeposit = 0;

  // If MetaMask is not available, we assume free version and assign default credits.
  if (!window.ethereum) {
    console.log("MetaMask not detected. Using default free version balance of 1000 MET.");
    window.initialDeposit = 1000;
    window.offchainBalance = 0;
    const creditsDisplay = document.getElementById("credits-display");
    if (creditsDisplay) creditsDisplay.innerText = "1000";
    // Skip wallet connection and on-chain balance retrieval.
  } else {
    // Flag to prevent duplicate wallet account requests.
    let isRequestingAccounts = false;

    async function connectWalletAndLoadBalances() {
      if (isRequestingAccounts) {
        console.log("Already processing wallet connection request. Please wait.");
        return;
      }
      console.log("Connect Wallet button clicked.");
      isRequestingAccounts = true;
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        if (!accounts || !accounts.length) {
          console.log("No accounts returned.");
          isRequestingAccounts = false;
          return;
        }
        const walletAddress = accounts[0];
        console.log("Connected wallet:", walletAddress);
        window.userWallet = walletAddress;
        alert("Wallet connected: " + walletAddress);

        // Fetch off-chain data from the backend.
        const response = await fetch(`/api/user/${walletAddress.toLowerCase()}`);
        const data = await response.json();
        console.log("Fetched off-chain user data:", data);
        const creditsDisplay = document.getElementById("credits-display");
        if (creditsDisplay) {
          creditsDisplay.innerText = data.total;
        }
        window.offchainBalance = parseFloat(data.balance) || 0;
        window.initialDeposit = parseFloat(data.deposit) || 0;

        await getOnChainMETBalance();
      } catch (error) {
        console.error("Error connecting wallet:", error);
        alert("Error connecting wallet. Check console for details.");
      } finally {
        isRequestingAccounts = false;
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
        if (onChainBalanceElement) {
          onChainBalanceElement.innerText = formattedBalance;
        }
        console.log("On-chain MET balance:", formattedBalance);
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
  }

  // updateInGameBalance: sends a POST to update the net play balance.
  window.updateInGameBalance = async function(delta) {
    // In free version with default balances, we can simply update the UI.
    if (!window.userWallet && !window.ethereum) {
      // Free version simulation
      console.log(`Updating simulated off-chain balance by ${delta} MET`);
      let current = parseFloat(document.getElementById("credits-display").innerText) || 0;
      current += delta;
      document.getElementById("credits-display").innerText = current.toString();
      window.initialDeposit = current;  // Reflect simulated deposit.
      window.offchainBalance = 0;
      return current;
    }

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
      console.log("Balance update response:", result);
      // Refresh the user's off-chain data
      const userResponse = await fetch(`/api/user/${window.userWallet.toLowerCase()}`);
      const data = await userResponse.json();
      console.log("Refreshed off-chain user data:", data);
      const total = parseFloat(data.deposit) + parseFloat(data.balance);
      const creditsDisplay = document.getElementById("credits-display");
      if (creditsDisplay) {
        creditsDisplay.innerText = total.toString();
      }
      window.offchainBalance = parseFloat(data.balance) || 0;
      return data.balance;
    } catch (error) {
      console.error("Error updating off-chain balance:", error);
    }
  };

  // manualDeposit: calls the deposit endpoint.
  window.manualDeposit = async function() {
    const depositInput = document.getElementById("depositInput");
    let amount = parseFloat(depositInput.value);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid deposit amount.");
      return;
    }
    try {
      const response = await fetch(`/api/deposit-offchain/${window.userWallet ? window.userWallet.toLowerCase() : "free"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amount })
      });
      const result = await response.json();
      console.log("Deposit response:", result);
      alert(result.message);
      // Refresh user data after deposit.
      const userResponse = await fetch(`/api/user/${window.userWallet ? window.userWallet.toLowerCase() : "free"}`);
      const data = await userResponse.json();
      console.log("Post-deposit off-chain user data:", data);
      const total = parseFloat(data.deposit) + parseFloat(data.balance);
      const creditsDisplay = document.getElementById("credits-display");
      if (creditsDisplay) {
        creditsDisplay.innerText = total.toString();
      }
      window.initialDeposit = parseFloat(data.deposit) || 0;
    } catch (error) {
      console.error("Error during deposit:", error);
      alert("Error during deposit. Check console for details.");
    }
  };

  // reconcileSession: calls the reconcile endpoint.
  window.reconcileSession = async function() {
    if (!window.userWallet && !window.ethereum) {
      alert("Free version mode: no on-chain reconciliation necessary.");
      return;
    }
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
