// public/game-logic.js

// Global toggles: set to true to disable a given win condition (for testing)
let pause5InRow = false;  // 5-in-a-row win (all reels in one row match)
let pause3InRow = false;  // 3-in-a-row win (any three consecutive matching icons)
let pause2InRow = false;  // 2-in-a-row win on middle row (row index 1)

function checkWin() {
  const reels = document.querySelectorAll('.col');
  let totalMultiplier = 0;
  console.log(`checkWin: Found ${reels.length} reels.`);
  
  // For each expected row index (0, 1, 2)
  for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
    let rowSymbols = [];
    
    reels.forEach((reel, reelIndex) => {
      // First try to get icons via the expected structure
      let icons = reel.querySelectorAll('.icon img');
      if (!icons || icons.length <= rowIndex) {
        console.warn(`Reel ${reelIndex} does not have enough ".icon img" children for row ${rowIndex}.`);
        // Fallback: get all img elements inside reel
        icons = reel.querySelectorAll("img");
      }
      
      if (icons && icons.length > rowIndex) {
        const img = icons[rowIndex];
        if (!img) {
          console.warn(`Icon at reel ${reelIndex}, row ${rowIndex} is undefined.`);
          rowSymbols.push("undefined");
        } else {
          const src = img.getAttribute("src");
          console.log(`Reel ${reelIndex}, row ${rowIndex} src: ${src}`);
          if (!src) {
            console.warn(`Reel ${reelIndex}, row ${rowIndex}: Image src is missing.`);
            rowSymbols.push("undefined");
          } else {
            const symbol = src.split('/').pop().split('.')[0];
            rowSymbols.push(symbol);
          }
        }
      } else {
        console.warn(`Reel ${reelIndex} has no images for row ${rowIndex}.`);
        rowSymbols.push("missing");
      }
    });
    
    console.log(`Row ${rowIndex} symbols: [${rowSymbols.join(", ")}]`);
    
    // --- 5-in-a-row win: All reels in this row match.
    if (!pause5InRow && rowSymbols.length === reels.length && rowSymbols.every(s => s === rowSymbols[0] && s !== "undefined" && s !== "missing")) {
      const multiplier5 = rowSymbols[0] === 'big_win' ? 10 : 5;
      console.log(`Row ${rowIndex}: 5-in-a-row win detected with symbol "${rowSymbols[0]}" giving multiplier ${multiplier5}.`);
      totalMultiplier += multiplier5;
    } else {
      console.log(`Row ${rowIndex}: 5-in-a-row win not detected.`);
    }
    
    // --- 3-in-a-row win: Check for any three consecutive matching symbols.
    if (!pause3InRow && rowSymbols.length >= 3) {
      let threeFound = false;
      for (let i = 0; i <= rowSymbols.length - 3; i++) {
        if (rowSymbols[i] && rowSymbols[i] !== "undefined" && rowSymbols[i] !== "missing" &&
            rowSymbols[i] === rowSymbols[i+1] && rowSymbols[i] === rowSymbols[i+2]) {
          console.log(`Row ${rowIndex}: 3-in-a-row win detected at reels ${i}-${i+2} with symbol "${rowSymbols[i]}", +2 multiplier.`);
          totalMultiplier += 2;
          threeFound = true;
          break; // Count only one instance per row.
        }
      }
      if (!threeFound) {
        console.log(`Row ${rowIndex}: No 3-in-a-row win detected.`);
      }
    }
    
    // --- 2-in-a-row win on the middle row (rowIndex === 1): Count every distinct consecutive pair.
    if (!pause2InRow && rowIndex === 1 && rowSymbols.length >= 2) {
      let pairCount = 0;
      for (let i = 0; i < rowSymbols.length - 1; i++) {
        if (rowSymbols[i] && rowSymbols[i] !== "undefined" && rowSymbols[i] !== "missing" &&
            rowSymbols[i] === rowSymbols[i+1]) {
          console.log(`Row 1: 2-in-a-row win detected at reels ${i} & ${i+1} with symbol "${rowSymbols[i]}", +0.25 multiplier.`);
          totalMultiplier += 0.25;
          pairCount++;
        }
      }
      if (pairCount === 0) {
        console.log("Row 1: No 2-in-a-row win detected.");
      } else {
        console.log(`Row 1: Total of ${pairCount} pair(s) detected (yielding +${(pairCount * 0.25)} multiplier).`);
      }
    }
  } // end for each row

  console.log(`Total multiplier from win conditions: ${totalMultiplier}`);
  
  if (totalMultiplier > 0) {
    const betInput = document.getElementById("bet-input");
    const betAmount = betInput && !isNaN(parseFloat(betInput.value)) ? parseFloat(betInput.value) : 50;
    const winnings = betAmount * totalMultiplier;
    console.log(`Winnings computed: ${winnings} MET (Bet: ${betAmount}, Total Multiplier: ${totalMultiplier})`);
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
  const msgElem = document.getElementById("message-display");
  if (msgElem) {
    msgElem.textContent = message;
    msgElem.style.color = isWin ? "green" : "red";
    msgElem.style.opacity = 1;
    setTimeout(() => { msgElem.style.opacity = 0; }, 3000);
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
  setTimeout(() => { container.removeChild(particleContainer); }, 2000);
}

/* ----- Wrap the Original spin() Function -----
   Before initiating a spin, it deducts the bet from the offchain play balance.
   It expects the off-chain play balance (window.offchainBalance) to be updated by your wallet.js.
*/
const originalSpin = window.spin;
window.spin = function(elem) {
  const betInput = document.getElementById("bet-input");
  const betAmount = betInput && !isNaN(parseFloat(betInput.value)) ? parseFloat(betInput.value) : 50;
  if (window.offchainBalance < betAmount) {
    showMessage("Not enough tokens", false);
    return;
  }
  console.log(`Deducting bet of ${betAmount} MET from play balance.`);
  window.updateInGameBalance(-betAmount);
  originalSpin(elem);
};
