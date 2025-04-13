// public/game-logic.js

// List of available symbols (should match filenames in your items folder)
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

// Define number of reels and rows
const NUM_REELS = 5;
const NUM_ROWS = 3;

// Global win condition toggles (set to true if you want to disable a win condition)
let pause5InRow = false;
let pause3InRow = false;
let pause2InRow = false;

// Set animation duration (milliseconds) to match your CSS spin animation
const animationDuration = 3000; // e.g., 3 seconds

/**
 * spin() – Called when the Spin button is clicked.
 * 1. Deducts the bet using updateInGameBalance().
 * 2. Adds the "spinning" class to trigger CSS animations.
 * 3. After the animation completes, generates a new random outcome,
 *    optionally forces a win configuration, updates the DOM,
 *    removes the spinning class, and calls checkWin().
 */
function spin(elem) {
  const betInput = document.getElementById("bet-input");
  let betAmount = (betInput && !isNaN(parseFloat(betInput.value))) ? parseFloat(betInput.value) : 50;
  // Deduct the bet from the off-chain balance.
  if (typeof window.updateInGameBalance === "function") {
    window.updateInGameBalance(-betAmount);
  }
  
  const container = document.getElementById("container");
  container.classList.add("spinning");
  console.log("Spin started; spinning animation applied.");
  
  setTimeout(() => {
    // Generate random outcome for each reel and row.
    let outcome = [];
    for (let i = 0; i < NUM_REELS; i++) {
      outcome[i] = [];
      for (let j = 0; j < NUM_ROWS; j++) {
        outcome[i][j] = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      }
    }
    
    // Force a win configuration with 50% chance.
    if (Math.random() < 0.5) {
      const winType = Math.floor(Math.random() * 3); // 0: 5-in-a-row, 1: 3-in-a-row, 2: 2-in-a-row (middle row)
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
    console.log("Final outcome generated:", outcome);
    container.classList.remove("spinning");
    checkWin();
  }, animationDuration);
}

/**
 * checkWin() – Reads the displayed outcome from the DOM (using img src) and computes the win multiplier.
 */
function checkWin() {
  const reels = document.querySelectorAll('.col');
  let totalMultiplier = 0;
  console.log(`checkWin: Found ${reels.length} reels.`);
  
  for (let rowIndex = 0; rowIndex < NUM_ROWS; rowIndex++) {
    let rowSymbols = [];
    reels.forEach((reel, reelIndex) => {
      let icons = reel.querySelectorAll('.icon img');
      if (!icons || icons.length <= rowIndex) {
        console.warn(`Reel ${reelIndex} missing ".icon img" for row ${rowIndex}; using fallback.`);
        icons = reel.querySelectorAll('img');
      }
      if (icons && icons.length > rowIndex) {
        const img = icons[rowIndex];
        if (!img) {
          rowSymbols.push("undefined");
        } else {
          const src = img.getAttribute("src");
          console.log(`Reel ${reelIndex}, row ${rowIndex} src: ${src}`);
          if (!src) {
            rowSymbols.push("undefined");
          } else {
            const parts = src.split('/');
            const file = parts.pop();
            const symbol = file.split('.')[0];
            rowSymbols.push(symbol);
          }
        }
      } else {
        rowSymbols.push("missing");
      }
    });
    
    console.log(`Row ${rowIndex} symbols: [${rowSymbols.join(', ')}]`);
    
    // 5-in-a-row: All reels in this row must have the same valid symbol.
    if (!pause5InRow && rowSymbols.every(s => s && s !== "undefined" && s !== "missing" && s === rowSymbols[0])) {
      const multiplier = (rowSymbols[0] === "big_win") ? 10 : 5;
      console.log(`Row ${rowIndex}: 5-in-a-row win with "${rowSymbols[0]}" (multiplier: ${multiplier}).`);
      totalMultiplier += multiplier;
    } else {
      console.log(`Row ${rowIndex}: 5-in-a-row win not detected.`);
    }
    
    // 3-in-a-row: Check any three consecutive matching symbols.
    if (!pause3InRow && rowSymbols.length >= 3) {
      let foundThree = false;
      for (let i = 0; i <= rowSymbols.length - 3; i++) {
        if (rowSymbols[i] && rowSymbols[i] !== "undefined" && rowSymbols[i] !== "missing" &&
            rowSymbols[i] === rowSymbols[i+1] && rowSymbols[i] === rowSymbols[i+2]) {
          console.log(`Row ${rowIndex}: 3-in-a-row win at reels ${i}-${i+2} with "${rowSymbols[i]}" (+2 multiplier).`);
          totalMultiplier += 2;
          foundThree = true;
          break;
        }
      }
      if (!foundThree) {
        console.log(`Row ${rowIndex}: No 3-in-a-row win detected.`);
      }
    }
    
    // 2-in-a-row win on middle row (row index 1)
    if (!pause2InRow && rowIndex === 1) {
      const validSymbols = rowSymbols.filter(s => s && s !== "undefined" && s !== "missing");
      console.log(`Row 1 valid symbols: [${validSymbols.join(', ')}]`);
      let pairCount = 0;
      for (let i = 0; i < validSymbols.length - 1; i++) {
        if (validSymbols[i] === validSymbols[i+1]) {
          console.log(`Row 1: 2-in-a-row win at reels ${i} & ${i+1} with "${validSymbols[i]}" (+0.25 multiplier).`);
          totalMultiplier += 0.25;
          pairCount++;
        }
      }
      if (pairCount === 0) console.log("Row 1: No 2-in-a-row win detected.");
      else console.log(`Row 1: Detected ${pairCount} pair(s) (+${pairCount * 0.25} multiplier).`);
    }
  }
  
  console.log(`Total win multiplier: ${totalMultiplier}`);
  
  // Compute winnings
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
