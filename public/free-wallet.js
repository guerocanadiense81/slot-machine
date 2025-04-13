// public/free-wallet.js

document.addEventListener("DOMContentLoaded", () => {
  console.log("Free mode detected. Using default simulation balance.");
  // Set default free simulation deposit as 1000 MET.
  window.initialDeposit = 1000;
  window.offchainBalance = 0;  // For simplicity, net play balance starts at 0.
  
  // Update the UI credits display.
  const creditsDisplay = document.getElementById("credits-display");
  if (creditsDisplay) {
    creditsDisplay.innerText = window.initialDeposit.toString();
  }
  
  // Simulate updateInGameBalance by simply updating the local deposit.
  window.updateInGameBalance = function(delta) {
    console.log(`Simulated off-chain balance update: delta ${delta} MET`);
    window.initialDeposit += delta;
    // Prevent credit from going negative.
    if (window.initialDeposit < 0) {
      window.initialDeposit = 0;
    }
    if (creditsDisplay) {
      creditsDisplay.innerText = window.initialDeposit.toString();
    }
    console.log("New simulated balance:", window.initialDeposit);
    return window.initialDeposit;
  };
  
  // Provide a manual deposit function (since no wallet is connected)
  window.manualDeposit = function() {
    const depositInput = document.getElementById("depositInput");
    let amount = parseFloat(depositInput.value);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid deposit amount.");
      return;
    }
    // Simulate deposit: Add the amount to initialDeposit.
    window.initialDeposit += amount;
    if (creditsDisplay) {
      creditsDisplay.innerText = window.initialDeposit.toString();
    }
    console.log(`Simulated deposit: added ${amount} MET, new balance: ${window.initialDeposit} MET`);
    alert("Deposit recorded.");
  };
});
