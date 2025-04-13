// public/game-logic.js

// Available symbols—ensure these names match your image file names in the /items folder.
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

// Define number of reels and rows.
const NUM_REELS = 5;
const NUM_ROWS = 3;

// Global toggles to disable particular win conditions for testing.
let pause5InRow = false;
let pause3InRow = false;
let pause2InRow = false;

// Set animation duration to match your CSS spin animation (in milliseconds).
const animationDuration = 3000; // For example, 3 seconds

/**
 * spin() – Triggered when the Spin button is clicked.
 *   1. Deducts the bet (via updateInGameBalance).
 *   2. Adds the "spinning" class to trigger your CSS animation.
 *   3. After the animation completes, it generates a random outcome (with an optional forced win),
 *      updates the reels in the DOM, and calculates wins by directly using the outcome data (without rereading the DOM).
 */
function spin(elem) {
  // Get the bet amount from the input (or use default 50).
  const betInput = document.getElementById("bet-input");
  let betAmount = (betInput && !isNaN(parseFloat(betInput.value))) ? parseFloat(betInput.value) : 50;
  
  // Check that total available balance (off-chain deposit + net play balance) is sufficient.
  const totalAvailable = (window.initialDeposit || 0) + (window.offchainBalance || 0);
  if (totalAvailable < betAmount) {
    showMessage("Not enough tokens", false);
    return;
  }
  
  // Deduct the bet from off-chain balance.
  if (typeof window.updateInGameBalance === "function") {
    window.updateInGameBalance(-betAmount);
  }
  
  // Add the "spinning" class to the container to trigger your pre‑existing CSS animations.
  const container = document.getElementById("container");
  container.classList.add("spinning");
  console.log("Spin started: CSS spinning animation applied.");
  
  // After the animation duration, generate a new outcome.
  setTimeout(() => {
    // Generate a 2D outcome array: outcome[reel][row]
    let outcome = [];
    for (let i = 0; i < NUM_REELS; i++) {
      outcome[i] = [];
      for (let j = 0; j < NUM_ROWS; j++) {
        outcome[i][j] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      }
    }
    
    // Optional: Force a win configuration with a set probability (e.g., 20% chance).
    if (Math.random() < 0.2) {
      const winType = Math.floor(Math.random() * 3); // 0: 5-in-a-row, 1: 3-in-a-row, 2: 2-in-a-row (middle row)
      if (winType === 0) {
        // Force a 5-in-a-row win on a random row.
        const winningRow = Math.floor(Math.random() * NUM_ROWS);
        const winningSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        for (let i = 0; i < NUM_REELS; i++) {
          outcome[i][winningRow] = winningSymbol;
        }
        console.log(`Forced 5-in-a-row win on row ${winningRow} with symbol ${winningSymbol}`);
      } else if (winType === 1) {
        // Force a 3-in-a-row win on a random row.
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
    
    // Update the DOM images with the generated outcome.
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
    console.log("Final outcome generated:", outcome);
    
    // Remove the spinning class after the outcome is updated.
    container.classList.remove("spinning");
    
    // Calculate wins based solely on the outcome array.
    calculateWin(outcome, betAmount);
  }, animationDuration);
}

/**
 * calculateWin(outcome, betAmount) – Uses the provided outcome array (generated in spin())
 * to compute a win multiplier based on these rules:
 * 1. 5‑in‑a‑row win: if every reel in a given row shows the same symbol (10× if symbol is "big_win", else 5×).
 * 2. 3‑in‑a‑row win: if any three consecutive reels in a row match exactly → +2.
 * 3. 2‑in‑a‑row win on the middle row (row index 1): each matching consecutive pair → +0.25.
 * It then calculates the winnings (betAmount × total multiplier), updates the balance via updateInGameBalance(),
 * and calls showMessage() and triggerWinAnimation() if a win occurred.
 */
function calculateWin(outcome, betAmount) {
  let totalMultiplier = 0;
  
  // For each row:
  for (let row = 0; row < NUM_ROWS; row++) {
    // Extract the symbols in this row from each reel.
    const rowSymbols = [];
    for (let reel = 0; reel < NUM_REELS; reel++) {
      rowSymbols.push(outcome[reel][row]);
    }
    console.log(`Row ${row} symbols: ${rowSymbols.join(', ')}`);
    
    // Rule 1: 5-in-a-row win (all reels in this row match):
    if (rowSymbols.every(s => s === rowSymbols[0])) {
      let multiplier = (rowSymbols[0] === "big_win") ? 10 : 5;
      console.log(`Row ${row}: 5-in-a-row win with "${rowSymbols[0]}" (multiplier: ${multiplier})`);
      totalMultiplier += multiplier;
    } else {
      console.log(`Row ${row}: 5-in-a-row win not detected.`);
    }
    
    // Rule 2: 3-in-a-row win (any three consecutive matching symbols):
    if (rowSymbols.length >= 3) {
      let win3 = false;
      for (let i = 0; i <= rowSymbols.length - 3; i++) {
        if (rowSymbols[i] === rowSymbols[i+1] && rowSymbols[i] === rowSymbols[i+2]) {
          console.log(`Row ${row}: 3-in-a-row win from reels ${i}-${i+2} with "${rowSymbols[i]}" (+2 multiplier).`);
          totalMultiplier += 2;
          win3 = true;
          break;
        }
      }
      if (!win3) {
        console.log(`Row ${row}: No 3-in-a-row win detected.`);
      }
    }
    
    // Rule 3: 2-in-a-row win on the middle row (row index 1)
    if (row === 1) {
      let pairCount = 0;
      for (let i = 0; i < rowSymbols.length - 1; i++) {
        if (rowSymbols[i] === rowSymbols[i+1]) {
          console.log(`Row 1: 2-in-a-row win at reels ${i} & ${i+1} with "${rowSymbols[i]}" (+0.25 multiplier).`);
          totalMultiplier += 0.25;
          pairCount++;
        }
      }
      if (pairCount === 0) {
        console.log("Row 1: No 2-in-a-row win detected.");
      } else {
        console.log(`Row 1: Total of ${pairCount} pair(s) detected (+${pairCount * 0.25} multiplier).`);
      }
    }
  }
  
  console.log(`Total win multiplier: ${totalMultiplier}`);
  
  if (totalMultiplier > 0) {
    const winnings = betAmount * totalMultiplier;
    console.log(`Winnings calculated: ${winnings} MET (Bet: ${betAmount} MET, Multiplier: ${totalMultiplier}).`);
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
  const disp = document.getElementById("message-display");
  if (disp) {
    disp.textContent = msg;
    disp.style.color = isWin ? "green" : "red";
    disp.style.opacity = 1;
    setTimeout(() => { disp.style.opacity = 0; }, 3000);
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
