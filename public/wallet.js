// public/wallet.js

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded; initializing wallet connection...");

  // Global variable to store off-chain balance (as a number)
  window.offchainBalance = 0; 

  async function connectWalletAndLoadBalances() {
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
      window.userWallet = walletAddress;  // Save wallet address for later use
      
      alert("Wallet connected: " + walletAddress);
      
      // Fetch off-chain virtual balance from the backend API
      const response = await fetch(`/api/user/${walletAddress.toLowerCase()}`);
      if (!response.ok) throw new Error("Failed to load balance from server.");
      
      const data = await response.json();
      console.log("Fetched off-chain balance:", data.balance);
      const creditsDisplay = document.getElementById("credits-display");
      if (creditsDisplay) {
        creditsDisplay.innerText = data.balance;
      }
      
      // Store the balance globally for later updates
      window.offchainBalance = parseFloat(data.balance) || 0;
      
      // Now, fetch on-chain MET balance and update UI
      await getOnChainMETBalance();
    } catch (error) {
      console.error("Error connecting wallet:", error);
      alert("Error connecting wallet. Check console for details.");
    }
  }

  async function getOnChainMETBalance() {
    if (!window.ethereum) {
      console.error("MetaMask not detected, cannot fetch on-chain balance.");
      return;
    }
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []); // Ensure accounts are available
      const signer = provider.getSigner();
      const walletAddress = await signer.getAddress();
      
      const MET_ABI = ["function balanceOf(address owner) view returns (uint256)"];
      const MET_CONTRACT_ADDRESS = "0xb80b92Be7402E1e2D3189fff261D672D8104b322";
      const metContract = new ethers.Contract(MET_CONTRACT_ADDRESS, MET_ABI, provider);
      
      const balanceBN = await metContract.balanceOf(walletAddress);
      const formattedBalance = ethers.utils.formatUnits(balanceBN, 18);
      console.log("On-chain MET balance:", formattedBalance);
      
      const onChainBalanceElement = document.getElementById("metOnChainBalance");
      if (onChainBalanceElement) {
        onChainBalanceElement.innerText = formattedBalance;
      } else {
        console.warn("UI element 'metOnChainBalance' not found.");
      }
      return formattedBalance;
    } catch (error) {
      console.error("Error fetching on-chain MET balance:", error);
    }
  }

  // Attach connect wallet event handler
  const connectWalletBtn = document.getElementById("connectWallet");
  if (connectWalletBtn) {
    connectWalletBtn.addEventListener("click", connectWalletAndLoadBalances);
    console.log("connectWallet event listener attached.");
  } else {
    console.error("Connect Wallet button not found in DOM.");
  }

  // Global function to update the off-chain balance via the backend
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
      console.log("Off-chain balance updated on backend:", result);
      const creditsDisplay = document.getElementById("credits-display");
      if (creditsDisplay) {
        creditsDisplay.innerText = result.newBalance;
      }
      // Update the global off-chain balance variable
      window.offchainBalance = parseFloat(result.newBalance);
    } catch (error) {
      console.error("Error updating off-chain balance:", error);
    }
  };

  // Global function for manual deposit
  window.manualDeposit = async function() {
    const depositInput = document.getElementById("depositInput");
    if (!depositInput) {
      alert("Deposit input field not found.");
      return;
    }
    let depositAmount = depositInput.value;
    if (!depositAmount || isNaN(depositAmount)) {
      alert("Please enter a valid deposit amount.");
      return;
    }
    depositAmount = parseFloat(depositAmount);
    
    // Calculate new balance based on current off-chain balance plus deposit
    const newBalance = window.offchainBalance + depositAmount;
    console.log("Depositing MET. Current:", window.offchainBalance, "Deposit:", depositAmount, "New balance:", newBalance);
    
    await window.updateInGameBalance(newBalance.toString());
    alert("Deposit successful! New off-chain balance: " + newBalance + " MET");
  }
});
