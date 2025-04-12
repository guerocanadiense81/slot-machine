// public/game-logic.js

// Global toggles to pause specific win conditions (set to true to disable a given condition)
let pause5InRow = false;   // 5-in-a-row win (all reels in a row match)
let pause3InRow = false;   // 3-in-a-row win (any three consecutive matching icons)
let pause2InRow = false;   // 2-in-a-row win on the middle row (row index 1)

// The following function checks win conditions across each row of reels.
// It expects that each reel (.col) has at least 3 child elements with class "icon"
// which contain an <img> with a src like "items/cherry.png".
function checkWin() {
  const reels = document.querySelectorAll('.col');
  let totalMultiplier = 0;
  console.log(`checkWin: Found ${reels.length} reels.`);

  // Process each of the three rows (rows 0, 1, 2)
  for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
    let rowSymbols = [];
    
    reels.forEach((reel, reelIndex) => {
      // Try to find image elements within .icon tags.
      let icons = reel.querySelectorAll('.icon img');
      if (!icons || icons.length <= rowIndex) {
        console.warn(`Reel ${reelIndex} does not have enough ".icon img" elements for row ${rowIndex}.`);
        // Fallback: try to find any img in the reel.
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
            const parts = src.split('/');
            const file = parts[parts.length - 1];
            const symbol = file.split('.')[0];
            rowSymbols.push(symbol);
          }
        }
      } else {
        console.warn(`Reel ${reelIndex} has no images for row ${rowIndex}.`);
        rowSymbols.push("missing");
      }
    });
    
    console.log(`Row ${rowIndex} symbols: [${rowSymbols.join(", ")}]`);
    
    // 5-in-a-row win: All reels in the row match (if they aren't "undefined" or "missing")
    if (!pause5InRow && rowSymbols.length === reels.length && rowSymbols.every(s => s !== "undefined" && s !== "missing" && s === rowSymbols[0])) {
      const multiplier5 = rowSymbols[0] === 'big_win' ? 10 : 5;
      console.log(`Row ${rowIndex}: 5-in-a-row win detected with "${rowSymbols[0]}" (multiplier ${multiplier5}).`);
      totalMultiplier += multiplier5;
    } else {
      console.log(`Row ${rowIndex}: 5-in-a-row win not detected.`);
    }
    
    // 3-in-a-row win: If any three consecutive icons in this row match.
    if (!pause3InRow && rowSymbols.length >= 3) {
      let threeFound = false;
      for (let i = 0; i <= rowSymbols.length - 3; i++) {
        if (rowSymbols[i] && rowSymbols[i] !== "undefined" && rowSymbols[i] !== "missing" &&
            rowSymbols[i] === rowSymbols[i+1] && rowSymbols[i] === rowSymbols[i+2]) {
          console.log(`Row ${rowIndex}: 3-in-a-row win detected at reels ${i}-${i+2} with symbol "${rowSymbols[i]}", +2 multiplier.`);
          totalMultiplier += 2;
          threeFound = true;
          break; // Count one 3-in-a-row occurrence per row.
        }
      }
      if (!threeFound) {
        console.log(`Row ${rowIndex}: No 3-in-a-row win detected.`);
      }
    }
    
    // 2-in-a-row win on middle row (row index 1): Count every distinct consecutive pair.
    if (!pause2InRow && rowIndex === 1 && rowSymbols.length >= 2) {
      let pairCount = 0;
      for (let i = 0; i < rowSymbols.length - 1; i++) {
        if (rowSymbols[i] && rowSymbols[i] !== "undefined" && rowSymbols[i] !== "missing" &&
            rowSymbols[i] === rowSymbols[i+1]) {
          console.log(`Row 1: 2-in-a-row win detected at reels ${i} and ${i+1} with symbol "${rowSymbols[i]}", +0.25 multiplier.`);
          totalMultiplier += 0.25;
          pairCount++;
          // Do not break; allow multiple pairs per row.
        }
      }
      if (pairCount === 0) {
        console.log("Row 1: No 2-in-a-row win detected.");
      } else {
        console.log(`Row 1: Total of ${pairCount} pair(s) detected.`);
      }
    }
  } // end for each row

  console.log(`Total multiplier: ${totalMultiplier}`);
  
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
  const animDiv = document.createElement("div");
  animDiv.classList.add("particle-container");
  container.appendChild(animDiv);
  for (let i = 0; i < 30; i++) {
    const particle = document.createElement("div");
    particle.classList.add("particle");
    animDiv.appendChild(particle);
    particle.style.left = Math.random() * 100 + "%";
    particle.style.animationDelay = Math.random() * 0.5 + "s";
  }
  setTimeout(() => {
    container.removeChild(animDiv);
  }, 2000);
}

/* ----- Wrap the Original spin() Function -----
   Before a spin, check that the total available (locked deposit + net play balance) 
   is at least the bet amount. If not, show an error message. Then, deduct the bet
   from the net play balance and call the original spin.
*/
const originalSpin = window.spin;
window.spin = function(elem) {
  const betInput = document.getElementById("bet-input");
  const betAmount = betInput && !isNaN(parseFloat(betInput.value)) ? parseFloat(betInput.value) : 50;
  
  // Total available = locked deposit (initialDeposit) + net play balance (offchainBalance)
  const totalAvailable = (window.initialDeposit || 0) + (window.offchainBalance || 0);
  console.log(`Before spin: Total available = ${totalAvailable} MET (Deposit: ${window.initialDeposit}, Play Balance: ${window.offchainBalance}), Bet: ${betAmount} MET`);
  
  if (totalAvailable < betAmount) {
    showMessage("Not enough tokens", false);
    return;
  }
  
  // Deduct the full bet amount from the net play balance.
  window.updateInGameBalance(-betAmount);
  originalSpin(elem);
};
