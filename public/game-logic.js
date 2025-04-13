// public/game-logic.js

// Global toggles: set these to true to disable win conditions (for testing)
let pause5InRow = false;    // 5-in-a-row win (all reels in a row match)
let pause3InRow = false;    // 3-in-a-row win (three consecutive matching icons in any row)
let pause2InRow = false;    // 2-in-a-row win on the middle row (row index 1)

// This function is called after a spin and calculates wins by reading images from each reel.
function checkWin() {
  const reels = document.querySelectorAll('.col');
  let totalMultiplier = 0;
  console.log(`checkWin: Found ${reels.length} reels.`);
  
  // Loop over each expected row (rows 0, 1, 2)
  for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
    let rowSymbols = [];
    
    reels.forEach((reel, reelIndex) => {
      // Try to get images inside elements with class "icon"
      let icons = reel.querySelectorAll('.icon img');
      // Log reel element for debugging
      console.log(`Reel ${reelIndex} element: `, reel);
      
      if (!icons || icons.length <= rowIndex) {
        console.warn(`Reel ${reelIndex} does not have enough ".icon img" elements for row ${rowIndex}. Using fallback selector.`);
        icons = reel.querySelectorAll("img");
      }
      
      if (icons && icons.length > rowIndex) {
        const img = icons[rowIndex];
        if (!img) {
          console.warn(`Reel ${reelIndex}, row ${rowIndex}: image element is undefined.`);
          rowSymbols.push("undefined");
        } else {
          const src = img.getAttribute("src");
          console.log(`Reel ${reelIndex}, row ${rowIndex} src: ${src}`);
          if (!src) {
            console.warn(`Reel ${reelIndex}, row ${rowIndex}: src attribute is missing.`);
            rowSymbols.push("undefined");
          } else {
            // Split src (expected: "items/cherry.png") to extract symbol
            const parts = src.split('/');
            const file = parts.pop();  // e.g., "cherry.png"
            const symbol = file.split('.')[0];  // e.g., "cherry"
            rowSymbols.push(symbol);
          }
        }
      } else {
        console.warn(`Reel ${reelIndex} has no image element for row ${rowIndex}.`);
        rowSymbols.push("missing");
      }
    });
    
    console.log(`Row ${rowIndex} symbols: [${rowSymbols.join(', ')}]`);
    
    // --- 5-in-a-row win: all reels must have the same valid symbol.
    if (!pause5InRow && rowSymbols.length === reels.length &&
        rowSymbols.every(s => s && s !== "undefined" && s !== "missing" && s === rowSymbols[0])) {
      const multiplier5 = (rowSymbols[0] === "big_win") ? 10 : 5;
      console.log(`Row ${rowIndex}: 5-in-a-row win detected with symbol "${rowSymbols[0]}" (multiplier: ${multiplier5}).`);
      totalMultiplier += multiplier5;
    } else {
      console.log(`Row ${rowIndex}: 5-in-a-row win condition not met.`);
    }
    
    // --- 3-in-a-row win: check for any three consecutive matching symbols.
    if (!pause3InRow && rowSymbols.length >= 3) {
      let threeFound = false;
      for (let i = 0; i <= rowSymbols.length - 3; i++) {
        if (rowSymbols[i] && rowSymbols[i] !== "undefined" && rowSymbols[i] !== "missing" &&
            rowSymbols[i] === rowSymbols[i+1] && rowSymbols[i] === rowSymbols[i+2]) {
          console.log(`Row ${rowIndex}: 3-in-a-row win detected at reels ${i}-${i+2} with symbol "${rowSymbols[i]}" (+2 multiplier).`);
          totalMultiplier += 2;
          threeFound = true;
          break; // Count only once per row.
        }
      }
      if (!threeFound) {
        console.log(`Row ${rowIndex}: No 3-in-a-row win detected.`);
      }
    }
    
    // --- 2-in-a-row win on the middle row (row 1):
    if (!pause2InRow && rowIndex === 1 && rowSymbols.length >= 2) {
      // Filter out invalid entries
      const validSymbols = rowSymbols.filter(s => s && s !== "undefined" && s !== "missing");
      console.log(`Row 1 valid symbols for 2-in-a-row: [${validSymbols.join(', ')}]`);
      let pairCount = 0;
      for (let i = 0; i < validSymbols.length - 1; i++) {
        if (validSymbols[i] === validSymbols[i+1]) {
          console.log(`Row 1: 2-in-a-row win at valid pair position ${i} & ${i+1} with symbol "${validSymbols[i]}" (+0.25 multiplier).`);
          totalMultiplier += 0.25;
          pairCount++;
        }
      }
      if (pairCount === 0) {
        console.log("Row 1: No 2-in-a-row win detected.");
      } else {
        console.log(`Row 1: Detected ${pairCount} pair(s) (+${pairCount * 0.25} multiplier).`);
      }
    }
  } // end for each row
  
  console.log(`Total multiplier from win conditions: ${totalMultiplier}`);
  
  if (totalMultiplier > 0) {
    const betInput = document.getElementById("bet-input");
    const betAmount = betInput && !isNaN(parseFloat(betInput.value)) ? parseFloat(betInput.value) : 50;
    const winnings = betAmount * totalMultiplier;
    console.log(`Calculated winnings: ${winnings} MET (Bet: ${betAmount} x Multiplier: ${totalMultiplier})`);
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
  const disp = document.getElementById("message-display");
  if (disp) {
    disp.textContent = message;
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

/* ----- Wrap Original spin() Function ----- */
const originalSpin = window.spin;
window.spin = function(elem) {
  const betInput = document.getElementById("bet-input");
  const betAmount = betInput && !isNaN(parseFloat(betInput.value)) ? parseFloat(betInput.value) : 50;
  // Total available = locked deposit + net play balance.
  const totalAvailable = (window.initialDeposit || 0) + (window.offchainBalance || 0);
  console.log(`Before spin: Total available = ${totalAvailable} MET (Deposit: ${window.initialDeposit}, Play: ${window.offchainBalance}), Bet: ${betAmount}`);
  if (totalAvailable < betAmount) {
    showMessage("Not enough tokens", false);
    return;
  }
  // Deduct bet from the net play balance.
  window.updateInGameBalance(-betAmount);
  originalSpin(elem);
};
