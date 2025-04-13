// public/game-logic.js

// Define available symbols (should match image files in /items)
const SYMBOLS = [
  "cherry",
  "lemon",
  "big_win",
  "banana",
  "grapes",
  "orange",
  "pear",
  "strawberry",
  "watermelon",
  "lucky_seven"
];

const NUM_REELS = 5;
const NUM_ROWS = 3;

// Global toggles for debugging win conditions (set to true to disable a condition)
let pause5InRow = false;
let pause3InRow = false;
let pause2InRow = false;

// Animation duration (should match your CSS animation duration in milliseconds)
const animationDuration = 3000; // 3 seconds

/**
 * spin() – Uses off-chain balance and triggers a spin.
 * It deducts the bet, triggers the spinning animation,
 * then generates a random outcome (with a low forced-win chance),
 * updates the reels in the DOM, and calculates the win.
 */
function spin(elem) {
  const betInput = document.getElementById("bet-input");
  let betAmount = (betInput && !isNaN(parseFloat(betInput.value)))
    ? parseFloat(betInput.value)
    : 50;
  
  // Check if total available is sufficient.
  const totalAvailable = (window.initialDeposit || 0) + (window.offchainBalance || 0);
  if (totalAvailable < betAmount) {
    showMessage("Not enough tokens", false);
    return;
  }
  
  // Deduct bet from off-chain balance.
  if (typeof window.updateInGameBalance === "function") {
    window.updateInGameBalance(-betAmount);
  }
  
  // Start the spin animation.
  const container = document.getElementById("container");
  container.classList.add("spinning");
  console.log("Spin started; triggering CSS animation.");
  
  setTimeout(() => {
    // Generate random outcome for each reel and row.
    let outcome = [];
    for (let i = 0; i < NUM_REELS; i++) {
      outcome[i] = [];
      for (let j = 0; j < NUM_ROWS; j++) {
        outcome[i][j] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      }
    }
    
    // Force a win configuration with 5% chance (adjustable).
    if (Math.random() < 0.05) {
      const winType = Math.floor(Math.random() * 3);
      if (winType === 0) {
        // Force a 5-in-a-row win.
        const winningRow = Math.floor(Math.random() * NUM_ROWS);
        const winningSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        for (let i = 0; i < NUM_REELS; i++) {
          outcome[i][winningRow] = winningSymbol;
        }
        console.log(`Forced 5-in-a-row win on row ${winningRow} with symbol ${winningSymbol}`);
      } else if (winType === 1) {
        // Force a 3-in-a-row win.
        const winningRow = Math.floor(Math.random() * NUM_ROWS);
        const startReel = Math.floor(Math.random() * (NUM_REELS - 2));
        const winningSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        for (let i = startReel; i < startReel + 3; i++) {
          outcome[i][winningRow] = winningSymbol;
        }
        console.log(`Forced 3-in-a-row win on row ${winningRow} for reels ${startReel}-${startReel+2} with symbol ${winningSymbol}`);
      } else if (winType === 2) {
        // Force a 2-in-a-row win on the middle row (row index 1).
        const winningSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        const startReel = Math.floor(Math.random() * (NUM_REELS - 1));
        outcome[startReel][1] = winningSymbol;
        outcome[startReel + 1][1] = winningSymbol;
        console.log(`Forced 2-in-a-row win on middle row for reels ${startReel} and ${startReel+1} with symbol ${winningSymbol}`);
      }
    }
    
    // Update the DOM with the new outcome.
    const reelContainers = document.querySelectorAll('.col');
    for (let i = 0; i < NUM_REELS; i++) {
      for (let j = 0; j < NUM_ROWS; j++) {
        if (reelContainers[i]) {
          let iconElements = reelContainers[i].querySelectorAll('.icon img');
          if (iconElements && iconElements[j]) {
            iconElements[j].setAttribute("src", "items/" + outcome[i][j] + ".png");
            iconElements[j].setAttribute("alt", outcome[i][j]);
          }
        }
      }
    }
    console.log("Final outcome:", outcome);
    
    container.classList.remove("spinning");
    
    // Calculate wins using the outcome array (without reading back from the DOM).
    calculateWin(outcome, betAmount);
  }, animationDuration);
}

/**
 * calculateWin(outcome, betAmount) – Computes a win multiplier based on the outcome.
 * Win rules:
 *  - 5-in-a-row win: all reels in a given row match:
 *      * if symbol === "big_win", multiplier is 3 (adjusted lower);
 *      * otherwise, multiplier is 2.
 *  - 3-in-a-row win: any three consecutive matching symbols → +1.
 *  - 2-in-a-row win on middle row (row index 1): each matching consecutive pair → +0.1.
 * The total win is betAmount multiplied by the total multiplier.
 */
function calculateWin(outcome, betAmount) {
  let totalMultiplier = 0;
  
  for (let row = 0; row < NUM_ROWS; row++) {
    const rowSymbols = [];
    for (let reel = 0; reel < NUM_REELS; reel++) {
      rowSymbols.push(outcome[reel][row]);
    }
    console.log(`Row ${row} symbols: ${rowSymbols.join(', ')}`);
    
    // 5-in-a-row win.
    if (rowSymbols.every(s => s === rowSymbols[0])) {
      const multiplier = (rowSymbols[0] === "big_win") ? 3 : 2; // Lowered multipliers.
      console.log(`Row ${row}: 5-in-a-row win with "${rowSymbols[0]}" (multiplier: ${multiplier})`);
      totalMultiplier += multiplier;
    } else {
      console.log(`Row ${row}: 5-in-a-row win not detected.`);
    }
    
    // 3-in-a-row win.
    for (let i = 0; i <= rowSymbols.length - 3; i++) {
      if (rowSymbols[i] === rowSymbols[i+1] && rowSymbols[i] === rowSymbols[i+2]) {
        console.log(`Row ${row}: 3-in-a-row win at reels ${i}-${i+2} with "${rowSymbols[i]}" (+1 multiplier)`);
        totalMultiplier += 1;
        break; // Count once per row.
      }
    }
    
    // 2-in-a-row win on the middle row.
    if (row === 1) {
      let pairCount = 0;
      for (let i = 0; i < rowSymbols.length - 1; i++) {
        if (rowSymbols[i] === rowSymbols[i+1]) {
          console.log(`Row 1: 2-in-a-row win at reels ${i} & ${i+1} with "${rowSymbols[i]}" (+0.1 multiplier)`);
          totalMultiplier += 0.1;
          pairCount++;
        }
      }
      if (pairCount > 0) {
        console.log(`Row 1: Total of ${pairCount} pair(s) detected (+${pairCount * 0.1} multiplier).`);
      }
    }
  }
  
  console.log(`Total win multiplier: ${totalMultiplier}`);
  
  if (totalMultiplier > 0) {
    const winnings = betAmount * totalMultiplier;
    console.log(`Winning amount: ${winnings} MET (Bet: ${betAmount}, Multiplier: ${totalMultiplier}).`);
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
function showMessage(msg, isWin) {
  const display = document.getElementById("message-display");
  if (display) {
    display.textContent = msg;
    display.style.color = isWin ? "green" : "red";
    display.style.opacity = 1;
    setTimeout(() => { display.style.opacity = 0; }, 3000);
  }
}

function triggerWinAnimation() {
  const container = document.getElementById("container");
  if (!container) return;
  const animDiv = document.createElement("div");
  animDiv.classList.add("particle-container");
  container.appendChild(animDiv);
  for (let i = 0; i < 30; i++) {
    const p = document.createElement("div");
    p.classList.add("particle");
    animDiv.appendChild(p);
    p.style.left = Math.random() * 100 + "%";
    p.style.animationDelay = Math.random() * 0.5 + "s";
  }
  setTimeout(() => { container.removeChild(animDiv); }, 2000);
}
