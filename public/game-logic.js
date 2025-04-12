// public/game-logic.js

// Global toggles to pause win conditions (set to true to disable that win check)
let pause5InRow = false;   // Pause full-row (5-in-a-row) win logic if true.
let pause3InRow = false;   // Pause three consecutive match win logic if true.
let pause2InRow = false;   // Pause 2-in-a-row win logic for the middle row if true.

/**
 * checkWin - Checks all rows for winning conditions and updates off-chain balance.
 *   The following win conditions are checked per row:
 *   1. 5-in-a-row: If all reels for the row have the same symbol,
 *      multiplier = 10 if symbol is "big_win", otherwise 5.
 *   2. 3-in-a-row: If any three consecutive reels in the row match, multiplier = 2.
 *   3. 2-in-a-row on middle row (row index 1): If any two consecutive match, multiplier = 0.25.
 * All multipliers are summed and the total win is (bet * totalMultiplier).
 */
function checkWin() {
  const reels = document.querySelectorAll('.col');
  let totalMultiplier = 0;
  
  // For debugging: log number of reels
  console.log(`Detected ${reels.length} reels in the game.`);
  
  // We assume each reel has at least 3 icons (rows 0, 1, and 2)
  for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
    let rowSymbols = [];
    reels.forEach((reel, reelIndex) => {
      const icons = reel.querySelectorAll('.icon img');
      if (icons.length > rowIndex) {
        const src = icons[rowIndex].getAttribute("src");
        const symbol = src.split('/').pop().split('.')[0];
        rowSymbols.push(symbol);
        console.log(`Reel ${reelIndex} row ${rowIndex}: ${symbol}`);
      } else {
        console.warn(`Reel ${reelIndex} does not have a row at index ${rowIndex}`);
      }
    });

    // 5-in-a-row win check: All symbols in this row match.
    if (!pause5InRow && rowSymbols.length === reels.length && rowSymbols.every(s => s === rowSymbols[0])) {
      let multiplier5 = rowSymbols[0] === 'big_win' ? 10 : 5;
      console.log(`Row ${rowIndex} full match detected with symbol "${rowSymbols[0]}". Multiplier: ${multiplier5}`);
      totalMultiplier += multiplier5;
    } else {
      console.log(`Row ${rowIndex} full match not detected. Symbols: [${rowSymbols.join(', ')}]`);
    }

    // 3-in-a-row win check: Check for any three consecutive matching symbols.
    if (!pause3InRow && rowSymbols.length >= 3) {
      let found3 = false;
      for (let i = 0; i <= rowSymbols.length - 3; i++) {
        if (rowSymbols[i] && rowSymbols[i] === rowSymbols[i+1] && rowSymbols[i] === rowSymbols[i+2]) {
          console.log(`Row ${rowIndex}: 3-in-a-row detected at reels ${i}-${i+2} (symbol: ${rowSymbols[i]}), +2 multiplier`);
          totalMultiplier += 2;
          found3 = true;
          break;
        }
      }
      if (!found3) console.log(`Row ${rowIndex}: No 3-in-a-row found.`);
    }

    // 2-in-a-row win for middle row (rowIndex === 1)
    if (!pause2InRow && rowIndex === 1 && rowSymbols.length >= 2) {
      let found2 = false;
      for (let i = 0; i <= rowSymbols.length - 2; i++) {
        if (rowSymbols[i] && rowSymbols[i] === rowSymbols[i+1]) {
          console.log(`Middle row: 2-in-a-row detected at reels ${i} and ${i+1} (symbol: ${rowSymbols[i]}), +0.25 multiplier`);
          totalMultiplier += 0.25;
          found2 = true;
          break;
        }
      }
      if (!found2) console.log(`Middle row: No 2-in-a-row found.`);
    }
  } // End for each row

  console.log(`Total multiplier for win conditions: ${totalMultiplier}`);
  
  // If any win conditions met, calculate winnings.
  if (totalMultiplier > 0) {
    const betInput = document.getElementById("bet-input");
    let betAmount = 50; // default bet
    if (betInput) {
      const val = parseFloat(betInput.value);
      if (!isNaN(val)) {
        betAmount = val;
      }
    }
    const winnings = betAmount * totalMultiplier;
    console.log(`Calculated winnings: ${winnings} MET (bet: ${betAmount} MET * multiplier: ${totalMultiplier})`);
    
    // Update off-chain balance with winnings
    if (typeof window.updateInGameBalance === "function") {
      window.updateInGameBalance(winnings);
    }
    showMessage(`You win! +${winnings} MET (Multiplier: ${totalMultiplier})`, true);
    triggerWinAnimation();
  } else {
    showMessage("You lose!", false);
  }
}

// --- Placeholder Functions for UI Feedback ---
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

// --- Wrap the Original spin() Function ---
const originalSpin = window.spin;
window.spin = function(elem) {
  // Deduct bet amount before spinning.
  const betInput = document.getElementById("bet-input");
  const betAmount = betInput && !isNaN(parseFloat(betInput.value)) ? parseFloat(betInput.value) : 50;
  
  // Ensure player has enough balance.
  if (window.offchainBalance <= 0) {
    showMessage("Not enough tokens", false);
    return;
  }
  console.log(`Deducting bet of ${betAmount} MET from off-chain balance.`);
  window.updateInGameBalance(-betAmount);
  
  // Proceed with original spin logic.
  originalSpin(elem);
};
