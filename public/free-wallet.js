// public/free-wallet.js

document.addEventListener("DOMContentLoaded", () => {
  console.log("Free mode detected. Using default simulation balance.");
  // Set default deposit for free mode.
  window.initialDeposit = 1000;
  window.offchainBalance = 0;  // net play balance starts at 0
  const creditsDisplay = document.getElementById("credits-display");
  if (creditsDisplay) {
    creditsDisplay.innerText = window.initialDeposit.toString();
  }
  
  // In free mode, updateInGameBalance simply adjusts the simulated total.
  window.updateInGameBalance = function(delta) {
    console.log(`Simulated updateInGameBalance: delta ${delta} MET`);
    window.initialDeposit += delta;
    // Prevent negative credits.
    if (window.initialDeposit < 0) {
      window.initialDeposit = 0;
    }
    if (creditsDisplay) {
      creditsDisplay.innerText = window.initialDeposit.toString();
    }
    console.log("New simulated balance:", window.initialDeposit);
    return window.initialDeposit;
  };
  
  // Manual deposit: add funds to the simulated deposit.
  window.manualDeposit = function() {
    const depositInput = document.getElementById("depositInput");
    let amount = parseFloat(depositInput.value);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid deposit amount.");
      return;
    }
    window.initialDeposit += amount;
    if (creditsDisplay) {
      creditsDisplay.innerText = window.initialDeposit.toString();
    }
    console.log(`Simulated deposit: added ${amount} MET, new balance: ${window.initialDeposit} MET`);
    alert("Deposit recorded.");
  };
});
