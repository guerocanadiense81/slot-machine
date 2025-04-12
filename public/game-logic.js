// public/game-logic.js

// Global toggles: set to true to disable the corresponding win condition.
let pause5InRow = false;  // Full row match win (5-in-a-row)
let pause3InRow = false;  // Any three consecutive matching icons in a row win (3-in-a-row)
let pause2InRow = false;  // 2-in-a-row win on the middle row (row index 1) with multiplier 0.25

/**
 * Main win-check function. Assumes that each reel (element with class "col")
 * shows 3 icons (rows 0, 1, and 2). The function iterates over each row,
 * checks for the different win conditions, sums up the multipliers, and calculates
 * the winnings as (bet * total multiplier). It then updates the off‑chain balance.
 */
function checkWin() {
  const reels = document.querySelectorAll('.col');
  let totalMultiplier = 0;
  
  // Assume there are 3 rows per reel (indexes 0, 1, and 2)
  for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
    let rowSymbols = [];
    
    // For each reel, get the icon in this row (if available)
    reels.forEach(reel => {
      const icons = reel.querySelectorAll('.icon img');
      if (icons && icons.length > rowIndex) {
        // Extract symbol name from the src: e.g., "items/cherry.png" -> "cherry"
        const src = icons[rowIndex].getAttribute("src");
        const symbol = src.split('/').pop().split('.')[0];
        rowSymbols.push(symbol);
      }
    });
    
    // --- 5-in-a-row win: all reels in the row match.
    if (!pause5InRow && rowSymbols.length === reels.length && rowSymbols.every(s => s && s === rowSymbols[0])) {
      let multiplier5 = (rowSymbols[0] === 'big_win') ? 10 : 5;
      console.log(`Row ${rowIndex} full match with symbol "${rowSymbols[0]}" wins with multiplier: ${multiplier5}`);
      totalMultiplier += multiplier5;
    }
    
    // --- 3-in-a-row win: any three consecutive matching icons in the row.
    if (!pause3InRow && rowSymbols.length >= 3) {
      for (let i = 0; i <= rowSymbols.length - 3; i++) {
        if (rowSymbols[i] && rowSymbols[i] === rowSymbols[i+1] && rowSymbols[i] === rowSymbols[i+2]) {
          console.log(`Row ${rowIndex} 3-in-a-row starting at reel ${i} wins with multiplier 2`);
          totalMultiplier += 2;
          break; // Count only one instance per row.
        }
      }
    }
    
    // --- 2-in-a-row win on middle row: only for rowIndex 1.
    if (!pause2InRow && rowIndex === 1 && rowSymbols.length >= 2) {
      for (let i = 0; i <= rowSymbols.length - 2; i++) {
        if (rowSymbols[i] && rowSymbols[i] === rowSymbols[i+1]) {
          console.log(`Middle row has 2-in-a-row at reels ${i} and ${i+1} wins with multiplier 0.25`);
          totalMultiplier += 0.25;
          break; // Only count one instance.
        }
      }
    }
  }
  
  // Now compute the winnings.
  if (totalMultiplier > 0) {
    const betInput = document.getElementById("bet-input");
    const betAmount = betInput && !isNaN(parseFloat(betInput.value)) ? parseFloat(betInput.value) : 50;
    const winnings = betAmount * totalMultiplier;
    console.log(`Total multiplier: ${totalMultiplier}, Bet: ${betAmount}, Winnings: ${winnings} MET`);
    
    if (typeof window.updateInGameBalance === "function") {
      window.updateInGameBalance(winnings);
    }
    showMessage(`You win! +${winnings} MET (Multiplier: ${totalMultiplier})`, true);
    triggerWinAnimation();
  } else {
    showMessage("You lose!", false);
  }
}

// Placeholder function for displaying a message on screen.
// Replace or extend as needed.
function showMessage(message, isWin) {
  const display = document.getElementById("message-display");
  if (display) {
    display.textContent = message;
    display.style.color = isWin ? 'green' : 'red';
    display.style.opacity = 1;
    setTimeout(() => {
      display.style.opacity = 0;
    }, 3000);
  }
}

// Placeholder for win animation (e.g., particle effect)
function triggerWinAnimation() {
  const container = document.getElementById("container");
  if (!container) return;
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

/*
  Wrap the original spin() function (assumed to exist on window) to deduct the bet amount before spinning.
  This code calls updateInGameBalance() to subtract the bet from the off-chain balance.
*/
const originalSpin = window.spin;
window.spin = function(elem) {
  if (window.offchainBalance === undefined || window.offchainBalance <= 0) {
    showMessage("Not enough tokens", false);
    return;
  }
  const betInput = document.getElementById("bet-input");
  const betAmount = betInput && !isNaN(parseFloat(betInput.value)) ? parseFloat(betInput.value) : 50;
  // Deduct the bet amount from the virtual balance.
  window.updateInGameBalance(-betAmount);
  // Call the original spin function to run the animation and eventually call checkWin() via setResult.
  originalSpin(elem);
};
