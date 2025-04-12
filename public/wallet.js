// public/wallet.js

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded; initializing wallet connection...");

  // Global variable to store off-chain balance as a number.
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
      window.userWallet = walletAddress;
      alert("Wallet connected: " + walletAddress);
      
      // Fetch off-chain balance from the backend
      const response = await fetch(`/api/user/${walletAddress.toLowerCase()}`);
      if (!response.ok) throw new Error("Failed to load balance from server.");
      
      const data = await response.json();
      console.log("Fetched off-chain balance:", data.balance);
      const creditsDisplay = document.getElementById("credits-display");
      if (creditsDisplay) {
        creditsDisplay.innerText = data.balance;
      }
      window.offchainBalance = parseFloat(data.balance) || 0;
      
      // Fetch on-chain MET balance
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
      await provider.send("eth_requestAccounts", []);
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
      }
    } catch (error) {
      console.error("Error fetching on-chain MET balance:", error);
    }
  }

  // Attach the wallet connect event handler
  const connectWalletBtn = document.getElementById("connectWallet");
  if (connectWalletBtn) {
    connectWalletBtn.addEventListener("click", connectWalletAndLoadBalances);
    console.log("connectWallet event listener attached.");
  } else {
    console.error("Connect Wallet button not found in DOM.");
  }

  // Global function: update off-chain balance (expects a relative change; positive or negative number).
  window.updateInGameBalance = async function(balanceChange) {
    if (!window.userWallet) {
      alert("Wallet not connected.");
      return;
    }
    try {
      const response = await fetch(`/api/user/${window.userWallet.toLowerCase()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balanceChange: balanceChange })
      });
      const result = await response.json();
      console.log("Off-chain balance updated on backend:", result);
      const creditsDisplay = document.getElementById("credits-display");
      if (creditsDisplay) {
        creditsDisplay.innerText = result.newBalance;
      }
      window.offchainBalance = parseFloat(result.newBalance);
      return result.newBalance;
    } catch (error) {
      console.error("Error updating off-chain balance:", error);
    }
  };

  // Global function: manual deposit.
  window.manualDeposit = async function() {
    const depositInput = document.getElementById("depositInput");
    if (!depositInput) {
      alert("Deposit input field not found.");
      return;
    }
    let depositAmount = parseFloat(depositInput.value);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      alert("Please enter a valid deposit amount.");
      return;
    }
    console.log("Depositing MET. Current:", window.offchainBalance, "Deposit:", depositAmount);
    // Update backend by adding depositAmount.
    await window.updateInGameBalance(depositAmount);
    alert("Deposit successful! New off-chain balance: " + window.offchainBalance + " MET");
  };

  // Global function: cash out.
  window.cashOut = async function() {
    if (!window.userWallet) {
      alert("Wallet not connected.");
      return;
    }
    try {
      const response = await fetch(`/api/cashout/${window.userWallet.toLowerCase()}`, {
        method: "POST"
      });
      if (!response.ok) {
        throw new Error("Cash out failed.");
      }
      const data = await response.json();
      alert("Cash out of " + data.cashedOut + " MET processed. Your off-chain balance is now 0.");
      // Update UI to reflect balance of 0.
      document.getElementById("credits-display").innerText = "0";
      window.offchainBalance = 0;
    } catch (error) {
      console.error("Error during cash out:", error);
      alert("Error during cash out. Check console for details.");
    }
  };
});
