// public/game-logic.js

// Global toggles (set these to true to disable a win condition for debugging)
let pause5InRow = false;
let pause3InRow = false;
let pause2InRow = false;

function checkWin() {
  const reels = document.querySelectorAll('.col');
  let totalMultiplier = 0;
  console.log(`checkWin: Found ${reels.length} reels.`);

  // Process each row (assumed rows: 0, 1, 2)
  for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
    let rowSymbols = [];
    
    reels.forEach((reel, reelIndex) => {
      // Try to select images within the .icon elements
      let icons = reel.querySelectorAll('.icon img');
      if (!icons || icons.length <= rowIndex) {
        console.warn(`Reel ${reelIndex} does not have enough ".icon img" for row ${rowIndex}. Trying fallback.`);
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
            console.warn(`Reel ${reelIndex}, row ${rowIndex}: src attribute missing.`);
            rowSymbols.push("undefined");
          } else {
            const parts = src.split('/');
            const file = parts[parts.length - 1];
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
    
    // 5-in-a-row win: All reels in this row match and are valid.
    if (!pause5InRow && rowSymbols.length === reels.length && rowSymbols.every(s => s && s !== "undefined" && s !== "missing" && s === rowSymbols[0])) {
      const multiplier5 = rowSymbols[0] === "big_win" ? 10 : 5;
      console.log(`Row ${rowIndex}: 5-in-a-row win with symbol "${rowSymbols[0]}" (multiplier: ${multiplier5})`);
      totalMultiplier += multiplier5;
    } else {
      console.log(`Row ${rowIndex}: 5-in-a-row win not detected.`);
    }
    
    // 3-in-a-row win: Check for any three consecutive matching symbols.
    if (!pause3InRow && rowSymbols.length >= 3) {
      let threeFound = false;
      for (let i = 0; i <= rowSymbols.length - 3; i++) {
        if (rowSymbols[i] && rowSymbols[i] !== "undefined" && rowSymbols[i] !== "missing" &&
            rowSymbols[i] === rowSymbols[i+1] && rowSymbols[i] === rowSymbols[i+2]) {
          console.log(`Row ${rowIndex}: 3-in-a-row win from reels ${i}-${i+2} with symbol "${rowSymbols[i]}" (+2 multiplier)`);
          totalMultiplier += 2;
          threeFound = true;
          break;
        }
      }
      if (!threeFound) {
        console.log(`Row ${rowIndex}: No 3-in-a-row win detected.`);
      }
    }
    
    // 2-in-a-row win on the middle row (rowIndex 1): Count every distinct consecutive pair.
    if (!pause2InRow && rowIndex === 1 && rowSymbols.length >= 2) {
      let pairCount = 0;
      for (let i = 0; i < rowSymbols.length - 1; i++) {
        if (rowSymbols[i] && rowSymbols[i] !== "undefined" && rowSymbols[i] !== "missing" &&
            rowSymbols[i] === rowSymbols[i+1]) {
          console.log(`Row 1: 2-in-a-row win at reels ${i} and ${i+1} with symbol "${rowSymbols[i]}" (+0.25)`);
          totalMultiplier += 0.25;
          pairCount++;
        }
      }
      if (pairCount === 0) console.log("Row 1: No 2-in-a-row win detected.");
      else console.log(`Row 1: ${pairCount} pair(s) detected.`);
    }
  } // end rows loop

  console.log(`Total multiplier: ${totalMultiplier}`);
  
  if (totalMultiplier > 0) {
    const betInput = document.getElementById("bet-input");
    const betAmount = betInput && !isNaN(parseFloat(betInput.value)) ? parseFloat(betInput.value) : 50;
    const winnings = betAmount * totalMultiplier;
    console.log(`Winnings calculated: ${winnings} MET (Bet: ${betAmount}, Multiplier: ${totalMultiplier})`);
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

/* ----- Wrap Original spin() Function ----- */
const originalSpin = window.spin;
window.spin = function(elem) {
  const betInput = document.getElementById("bet-input");
  const betAmount = betInput && !isNaN(parseFloat(betInput.value)) ? parseFloat(betInput.value) : 50;
  // Total available is the sum of the locked deposit and net play balance.
  const totalAvailable = (window.initialDeposit || 0) + (window.offchainBalance || 0);
  console.log(`Before spin: Total available = ${totalAvailable} MET (Deposit: ${window.initialDeposit}, Play: ${window.offchainBalance}), Bet: ${betAmount}`);
  if (totalAvailable < betAmount) {
    showMessage("Not enough tokens", false);
    return;
  }
  // Deduct bet amount from net play balance.
  window.updateInGameBalance(-betAmount);
  originalSpin(elem);
};
