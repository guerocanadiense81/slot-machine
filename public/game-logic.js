// public/game-logic.js

// Global toggles to pause win conditions (set to true to disable that win condition)
let pause5InRow = false;   // Disables full-row wins if true.
let pause3InRow = false;   // Disables three consecutive matching wins if true.
let pause2InRow = false;   // Disables two consecutive matching wins on the middle row if true.

/**
 * checkWin - Checks each row for win conditions and calculates a total multiplier.
 * For each reel row (assumed to be indices 0, 1, and 2):
 *
 * 1. 5-in-a-row win:
 *    - If all reels in that row have the same symbol,
 *      multiplier = 10 if symbol is "big_win", else 5.
 *
 * 2. 3-in-a-row win:
 *    - If any three consecutive reels in that row match (only one instance is counted),
 *      multiplier = 2.
 *
 * 3. 2-in-a-row win on middle row (row index 1):
 *    - Loops through the middle row without breaking so that every consecutive matching pair
 *      is counted. Each pair adds 0.25 to the multiplier.
 *
 * Then, winnings = bet × total multiplier.
 * If any win condition is met (total multiplier > 0), the function calls
 * window.updateInGameBalance(winnings) to update the player's off-chain balance.
 */
function checkWin() {
  const reels = document.querySelectorAll('.col');
  let totalMultiplier = 0;
  
  console.log(`Checking win conditions for ${reels.length} reels...`);
  
  // Process each of the 3 rows.
  for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
    let rowSymbols = [];
    
    reels.forEach((reel, reelIndex) => {
      const icons = reel.querySelectorAll('.icon img');
      if (icons && icons.length > rowIndex) {
        const src = icons[rowIndex].getAttribute("src");
        const symbol = src.split('/').pop().split('.')[0];
        rowSymbols.push(symbol);
        console.log(`Reel ${reelIndex}, row ${rowIndex}: ${symbol}`);
      } else {
        console.warn(`Reel ${reelIndex} missing row ${rowIndex}`);
      }
    });
    
    // --- 5-in-a-row win: All reels in this row match.
    if (!pause5InRow && rowSymbols.length === reels.length && rowSymbols.every(s => s === rowSymbols[0])) {
      const multiplier5 = rowSymbols[0] === 'big_win' ? 10 : 5;
      console.log(`Row ${rowIndex}: Full match detected with symbol "${rowSymbols[0]}" - multiplier ${multiplier5}`);
      totalMultiplier += multiplier5;
    } else {
      console.log(`Row ${rowIndex} full match not detected. Symbols: [${rowSymbols.join(', ')}]`);
    }
    
    // --- 3-in-a-row win: Check for any three consecutive matching symbols.
    if (!pause3InRow && rowSymbols.length >= 3) {
      let found3 = false;
      for (let i = 0; i <= rowSymbols.length - 3; i++) {
        if (rowSymbols[i] && rowSymbols[i] === rowSymbols[i+1] && rowSymbols[i] === rowSymbols[i+2]) {
          console.log(`Row ${rowIndex}: 3-in-a-row detected at reels ${i}-${i+2} with symbol "${rowSymbols[i]}" - +2 multiplier`);
          totalMultiplier += 2;
          found3 = true;
          break; // Count one 3-in-a-row per row.
        }
      }
      if (!found3) {
        console.log(`Row ${rowIndex}: No 3-in-a-row match detected.`);
      }
    }
    
    // --- 2-in-a-row win on the middle row: Check for every consecutive pair.
    if (!pause2InRow && rowIndex === 1 && rowSymbols.length >= 2) {
      let pairCount = 0;
      for (let i = 0; i <= rowSymbols.length - 2; i++) {
        if (rowSymbols[i] && rowSymbols[i] === rowSymbols[i+1]) {
          console.log(`Middle row: 2-in-a-row detected at reels ${i} and ${i+1} with symbol "${rowSymbols[i]}" - +0.25 multiplier`);
          totalMultiplier += 0.25;
          pairCount++;
        }
      }
      if (pairCount === 0) {
        console.log("Middle row: No 2-in-a-row match detected.");
      } else {
        console.log(`Middle row: ${pairCount} pair(s) detected, total +${(pairCount * 0.25)} multiplier`);
      }
    }
  } // End rows loop
  
  console.log(`Total multiplier: ${totalMultiplier}`);
  
  // Calculate winnings if any win condition is met.
  if (totalMultiplier > 0) {
    const betInput = document.getElementById("bet-input");
    const betAmount = betInput && !isNaN(parseFloat(betInput.value)) ? parseFloat(betInput.value) : 50;
    const winnings = betAmount * totalMultiplier;
    console.log(`Winnings: ${winnings} MET (Bet: ${betAmount} × Multiplier: ${totalMultiplier})`);
    
    // Update off-chain balance with the winnings.
    if (typeof window.updateInGameBalance === "function") {
      window.updateInGameBalance(winnings);
    }
    showMessage(`You win! +${winnings} MET (Multiplier: ${totalMultiplier})`, true);
    triggerWinAnimation();
  } else {
    showMessage("You lose!", false);
  }
}

/* ----- Helper Functions ----- */

// Function to show a win/loss message.
function showMessage(message, isWin) {
  const msgElem = document.getElementById("message-display");
  if (msgElem) {
    msgElem.textContent = message;
    msgElem.style.color = isWin ? "green" : "red";
    msgElem.style.opacity = 1;
    setTimeout(() => {
      msgElem.style.opacity = 0;
    }, 3000);
  }
}

// Function to trigger a particle effect animation.
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

/* ----- Wrap the Original spin() Function -----
   Before spinning, the bet amount is deducted from the play balance.
   It checks that the total available (locked deposit + net play balance) is at least the bet.
*/
const originalSpin = window.spin;
window.spin = function(elem) {
  const betInput = document.getElementById("bet-input");
  const betAmount = betInput && !isNaN(parseFloat(betInput.value)) ? parseFloat(betInput.value) : 50;
  // Total available = initialDeposit (locked) + offchainBalance (net play)
  const totalAvailable = window.initialDeposit + window.offchainBalance;
  console.log(`Total available = ${totalAvailable} MET (Deposit: ${window.initialDeposit}, Play Balance: ${window.offchainBalance})`);
  
  if (totalAvailable < betAmount) {
    showMessage("Not enough tokens", false);
    return;
  }
  
  // Deduct the entire bet from the net play balance.
  window.updateInGameBalance(-betAmount);
  originalSpin(elem);
};
