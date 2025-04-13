// public/game-logic.js

// Define the symbols corresponding to your image names.
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

// Configure number of reels and rows.
const NUM_REELS = 5;
const NUM_ROWS = 3;

// Global toggles to disable any win condition (for testing)
let pause5InRow = false;
let pause3InRow = false;
let pause2InRow = false;

/**
 * spin() – Generates a random outcome, forces a win (with some probability),
 * updates the DOM accordingly, and then calculates wins using checkWin().
 */
function spin(elem) {
  // Generate a random outcome for each reel and row.
  let outcome = [];
  for (let i = 0; i < NUM_REELS; i++) {
    outcome[i] = [];
    for (let j = 0; j < NUM_ROWS; j++) {
      outcome[i][j] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    }
  }

  // Force a win configuration with a set probability (e.g. 50% chance).
  // You can adjust this probability as desired.
  if (Math.random() < 0.5) {
    // Choose a random win type: 0 for 5-in-a-row, 1 for 3-in-a-row, 2 for 2-in-a-row (middle row)
    const winType = Math.floor(Math.random() * 3);
    if (winType === 0) {
      // Force a 5-in-a-row win on a randomly chosen row.
      const winningRow = Math.floor(Math.random() * NUM_ROWS);
      // Pick a winning symbol at random.
      const winningSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      for (let i = 0; i < NUM_REELS; i++) {
        outcome[i][winningRow] = winningSymbol;
      }
      console.log(`Forced 5-in-a-row win on row ${winningRow} with symbol ${winningSymbol}`);
    } else if (winType === 1) {
      // Force a 3-in-a-row win:
      // Choose a random row and a random starting reel such that three consecutive reels exist.
      const winningRow = Math.floor(Math.random() * NUM_ROWS);
      const startReel = Math.floor(Math.random() * (NUM_REELS - 2));
      const winningSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      for (let i = startReel; i < startReel + 3; i++) {
        outcome[i][winningRow] = winningSymbol;
      }
      console.log(`Forced 3-in-a-row win on row ${winningRow} for reels ${startReel}-${startReel+2} with symbol ${winningSymbol}`);
    } else if (winType === 2) {
      // Force a 2-in-a-row win on the middle row (assumed row index 1).
      // For a 2-in-a-row win, choose a random starting reel where a pair is possible.
      const winningSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const startReel = Math.floor(Math.random() * (NUM_REELS - 1));
      outcome[startReel][1] = winningSymbol;
      outcome[startReel + 1][1] = winningSymbol;
      console.log(`Forced 2-in-a-row win on middle row for reels ${startReel} and ${startReel+1} with symbol ${winningSymbol}`);
    }
  }

  // Update the DOM with the generated outcome.
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
  console.log("Final generated outcome:", outcome);
  // Call checkWin using the outcome that was displayed.
  checkWin();
}

/**
 * checkWin() – Loops over each row to compute wins based on the displayed outcome.
 * It assumes that the reels have been updated via spin() and uses the current DOM values.
 */
function checkWin() {
  const reels = document.querySelectorAll('.col');
  let totalMultiplier = 0;
  console.log(`checkWin: Found ${reels.length} reels.`);
  
  // Process each row (0, 1, 2).
  for (let rowIndex = 0; rowIndex < NUM_ROWS; rowIndex++) {
    let rowSymbols = [];
    
    reels.forEach((reel, reelIndex) => {
      let icons = reel.querySelectorAll('.icon img');
      if (!icons || icons.length <= rowIndex) {
        console.warn(`Reel ${reelIndex} missing expected ".icon img" for row ${rowIndex}. Using fallback.`);
        icons = reel.querySelectorAll("img");
      }
      if (icons && icons.length > rowIndex) {
        const img = icons[rowIndex];
        if (!img) {
          console.warn(`Reel ${reelIndex}, row ${rowIndex}: image element not found.`);
          rowSymbols.push("undefined");
        } else {
          const src = img.getAttribute("src");
          console.log(`Reel ${reelIndex}, row ${rowIndex} src: ${src}`);
          if (!src) {
            console.warn(`Reel ${reelIndex}, row ${rowIndex}: missing src attribute.`);
            rowSymbols.push("undefined");
          } else {
            const parts = src.split('/');
            const file = parts.pop();
            const symbol = file.split('.')[0];
            rowSymbols.push(symbol);
          }
        }
      } else {
        console.warn(`Reel ${reelIndex} has no image for row ${rowIndex}.`);
        rowSymbols.push("missing");
      }
    });
    
    console.log(`Row ${rowIndex} symbols: [${rowSymbols.join(', ')}]`);
    
    // 5-in-a-row win: all reels in the row must have the same valid symbol.
    if (!pause5InRow && rowSymbols.length === reels.length &&
        rowSymbols.every(s => s && s !== "undefined" && s !== "missing" && s === rowSymbols[0])) {
      const multiplier5 = (rowSymbols[0] === "big_win") ? 10 : 5;
      console.log(`Row ${rowIndex}: 5-in-a-row win detected with "${rowSymbols[0]}" (multiplier: ${multiplier5}).`);
      totalMultiplier += multiplier5;
    } else {
      console.log(`Row ${rowIndex}: 5-in-a-row win condition not met.`);
    }
    
    // 3-in-a-row win: look for three consecutive matching symbols in the row.
    if (!pause3InRow && rowSymbols.length >= 3) {
      let foundThree = false;
      for (let i = 0; i <= rowSymbols.length - 3; i++) {
        if (rowSymbols[i] && rowSymbols[i] !== "undefined" && rowSymbols[i] !== "missing" &&
            rowSymbols[i] === rowSymbols[i+1] && rowSymbols[i] === rowSymbols[i+2]) {
          console.log(`Row ${rowIndex}: 3-in-a-row win at reels ${i}-${i+2} with symbol "${rowSymbols[i]}" (+2 multiplier).`);
          totalMultiplier += 2;
          foundThree = true;
          break;
        }
      }
      if (!foundThree) {
        console.log(`Row ${rowIndex}: No 3-in-a-row win detected.`);
      }
    }
    
    // 2-in-a-row win on the middle row (row 1): count each distinct consecutive pair.
    if (!pause2InRow && rowIndex === 1 && rowSymbols.length >= 2) {
      const validSymbols = rowSymbols.filter(s => s && s !== "undefined" && s !== "missing");
      console.log(`Row 1 valid symbols for 2-in-a-row: [${validSymbols.join(', ')}]`);
      let pairCount = 0;
      for (let i = 0; i < validSymbols.length - 1; i++) {
        if (validSymbols[i] === validSymbols[i+1]) {
          console.log(`Row 1: 2-in-a-row win at reels ${i} & ${i+1} with symbol "${validSymbols[i]}" (+0.25 multiplier).`);
          totalMultiplier += 0.25;
          pairCount++;
        }
      }
      if (pairCount === 0) console.log("Row 1: No 2-in-a-row win detected.");
      else console.log(`Row 1: Detected ${pairCount} pair(s) (total +${pairCount * 0.25} multiplier).`);
    }
  }
  
  console.log(`Total win multiplier: ${totalMultiplier}`);
  
  const betInput = document.getElementById("bet-input");
  let betAmount = 50;
  if (betInput && !isNaN(parseFloat(betInput.value))) {
    betAmount = parseFloat(betInput.value);
  }
  if (totalMultiplier > 0) {
    const winnings = betAmount * totalMultiplier;
    console.log(`Win detected! Bet: ${betAmount} MET, Multiplier: ${totalMultiplier}, Winnings: ${winnings} MET.`);
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
function showMessage(message, isWin) {
  const display = document.getElementById("message-display");
  if (display) {
    display.textContent = message;
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

/* ----- Wrap the Original spin() Function ----- */
// This version completely replaces the previous outcome by generating a new random outcome,
// possibly forcing a win configuration, updating the DOM, and then calling checkWin.
const originalSpin = window.spin;
window.spin = function(elem) {
  // Generate completely random outcome for each reel
  let outcome = [];
  for (let i = 0; i < NUM_REELS; i++) {
    outcome[i] = [];
    for (let j = 0; j < NUM_ROWS; j++) {
      outcome[i][j] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    }
  }
  
  // Force a win configuration with 50% chance:
  if (Math.random() < 0.5) {
    const winType = Math.floor(Math.random() * 3); // 0: 5-in-a-row, 1: 3-in-a-row, 2: 2-in-a-row (middle)
    if (winType === 0) {
      const winningRow = Math.floor(Math.random() * NUM_ROWS);
      const winningSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      for (let i = 0; i < NUM_REELS; i++) {
        outcome[i][winningRow] = winningSymbol;
      }
      console.log(`Forced 5-in-a-row win on row ${winningRow} with symbol ${winningSymbol}`);
    } else if (winType === 1) {
      const winningRow = Math.floor(Math.random() * NUM_ROWS);
      const startReel = Math.floor(Math.random() * (NUM_REELS - 2));
      const winningSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      for (let i = startReel; i < startReel + 3; i++) {
        outcome[i][winningRow] = winningSymbol;
      }
      console.log(`Forced 3-in-a-row win on row ${winningRow} for reels ${startReel}-${startReel+2} with symbol ${winningSymbol}`);
    } else if (winType === 2) {
      // Only on middle row
      const winningSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const startReel = Math.floor(Math.random() * (NUM_REELS - 1));
      outcome[startReel][1] = winningSymbol;
      outcome[startReel + 1][1] = winningSymbol;
      console.log(`Forced 2-in-a-row win on middle row for reels ${startReel} and ${startReel+1} with symbol ${winningSymbol}`);
    }
  }
  
  // Update the DOM with the outcome
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
  // Call checkWin() to calculate wins based on the updated DOM.
  checkWin();
};
