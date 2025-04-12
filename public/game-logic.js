// public/game-logic.js

// Global toggles to pause individual win conditions (set to true to disable that condition)
let pause5InRow = false;   // Set to true to disable full-row (5-in-a-row) wins
let pause3InRow = false;   // Set to true to disable any three consecutive reels win condition
let pause2InRow = false;   // Set to true to disable 2-in-a-row wins on the middle row only

/**
 * Check the win conditions after the spin.
 * For each of the three rows, this function:
 *   - Checks if all reels have the same symbol (5-in-a-row).
 *   - Checks for any three consecutive matching icons (3-in-a-row).
 *   - For the middle row, checks for any two consecutive matching icons (2-in-a-row).
 * Then, sums the multipliers and calculates the winnings.
 */
function checkWin() {
  // Get all reels (assumed to be elements with class "col")
  const reels = document.querySelectorAll('.col');
  
  // We'll treat each row separately. Assume rows 0,1,2.
  let totalMultiplier = 0;
  
  for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
    let rowSymbols = [];
    // Extract the symbol from each reel for the given row index.
    reels.forEach(reel => {
      // Each reel is expected to contain children with class "icon" containing an img.
      const icons = reel.querySelectorAll('.icon img');
      if (icons[rowIndex]) {
        // Assume src format: "items/symbol.png". Extract "symbol".
        const src = icons[rowIndex].getAttribute("src");
        const symbol = src.split('/').pop().split('.')[0];
        rowSymbols.push(symbol);
      }
    });
    
    // 5-in-a-row win: All reels in this row have the same symbol.
    if (!pause5InRow && rowSymbols.length === reels.length && rowSymbols.every(s => s && s === rowSymbols[0])) {
      let multiplier = (rowSymbols[0] === 'big_win') ? 10 : 5;
      console.log(`Row ${rowIndex} wins 5-in-a-row with symbol ${rowSymbols[0]}, multiplier: ${multiplier}`);
      totalMultiplier += multiplier;
    }
    
    // 3-in-a-row win: Look for any three consecutive reels in this row that match.
    if (!pause3InRow && rowSymbols.length >= 3) {
      for (let i = 0; i <= rowSymbols.length - 3; i++) {
        if (rowSymbols[i] && rowSymbols[i] === rowSymbols[i+1] && rowSymbols[i] === rowSymbols[i+2]) {
          console.log(`Row ${rowIndex} wins 3-in-a-row starting at reel ${i}, multiplier: 2`);
          totalMultiplier += 2;
          break; // Count only one instance per row.
        }
      }
    }
    
    // 2-in-a-row win: Only for the middle row (rowIndex 1).
    if (!pause2InRow && rowIndex === 1 && rowSymbols.length >= 2) {
      for (let i = 0; i <= rowSymbols.length - 2; i++) {
        if (rowSymbols[i] && rowSymbols[i] === rowSymbols[i+1]) {
          console.log(`Middle row wins 2-in-a-row at reels ${i} and ${i+1}, multiplier: 0.25`);
          totalMultiplier += 0.25;
          break; // Only count one instance.
        }
      }
    }
  }
  
  // If totalMultiplier is greater than 0, the player wins.
  if (totalMultiplier > 0) {
    // Retrieve bet value from the input with id "bet-input"
    const betInput = document.getElementById("bet-input");
    const betAmount = betInput ? parseFloat(betInput.value) : 50; // Default to 50 if not found
    const winnings = betAmount * totalMultiplier;
    console.log(`Winnings computed: ${winnings} MET (bet: ${betAmount} MET, total multiplier: ${totalMultiplier})`);
    
    // Update off-chain balance by calling updateInGameBalance (assumed global function)
    if (typeof window.updateInGameBalance === "function") {
      window.updateInGameBalance(winnings);
    }
    showMessage(`You win! +${winnings} MET (Multiplier: ${totalMultiplier})`, true);
    triggerWinAnimation();
  } else {
    showMessage("You lose!", false);
  }
}

/**
 * Placeholder function to display a win/loss message.
 * You can replace this with your custom UI code.
 * @param {string} message - The message to display.
 * @param {boolean} isWin - true if win (green), false if loss (red).
 */
function showMessage(message, isWin) {
  const messageDisplay = document.getElementById("message-display");
  if (messageDisplay) {
    messageDisplay.textContent = message;
    messageDisplay.style.color = isWin ? 'green' : 'red';
    messageDisplay.style.opacity = 1;
    setTimeout(() => {
      messageDisplay.style.opacity = 0;
    }, 3000);
  }
}

/**
 * Placeholder function to trigger a win animation.
 * Replace this with your actual animation logic.
 */
function triggerWinAnimation() {
  const container = document.getElementById("container");
  if (container) {
    const particleContainer = document.createElement("div");
    particleContainer.classList.add("particle-container");
    container.appendChild(particleContainer);
    for (let i = 0; i < 30; i++) {
      const particle = document.createElement("div");
      particle.classList.add("particle");
      particleContainer.appendChild(particle);
      particle.style.left = Math.random() * 100 + "%";
      particle.style.animationDelay = Math.random() * 0.5 + "s";
    }
    setTimeout(() => {
      container.removeChild(particleContainer);
    }, 2000);
  }
}

/* 
  Wrap the original spin function to ensure bet deduction occurs before spinning.
  This code assumes your original spin function is stored in window.spin.
*/
const originalSpin = window.spin;
window.spin = function(elem) {
  // Check if sufficient off-chain balance exists
  if (window.offchainBalance === undefined || window.offchainBalance <= 0) {
    showMessage("Not enough tokens", false);
    return;
  }
  // Deduct the bet amount before spinning
  const betInput = document.getElementById("bet-input");
  const betAmount = betInput ? parseFloat(betInput.value) : 50;
  window.updateInGameBalance(-betAmount);
  // Call the original spin function
  originalSpin(elem);
};
