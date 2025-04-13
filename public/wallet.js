// public/game-logic.js

// Global toggles to disable win conditions for testing
let pause5InRow = false;
let pause3InRow = false;
let pause2InRow = false;

function checkWin() {
  const reels = document.querySelectorAll('.col');
  let totalMultiplier = 0;
  console.log(`checkWin: Found ${reels.length} reels.`);

  // Process each row (rows 0, 1, and 2)
  for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
    let rowSymbols = [];
    
    reels.forEach((reel, reelIndex) => {
      let icons = reel.querySelectorAll('.icon img');
      if (!icons || icons.length <= rowIndex) {
        console.warn(`Reel ${reelIndex} missing ".icon img" for row ${rowIndex}; using fallback selector.`);
        icons = reel.querySelectorAll('img');
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
            console.warn(`Reel ${reelIndex}, row ${rowIndex}: src attribute is missing.`);
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
    
    // 5-in-a-row win: all reels must have the same valid symbol.
    if (!pause5InRow && rowSymbols.length === reels.length &&
        rowSymbols.every(s => s && s !== "undefined" && s !== "missing" && s === rowSymbols[0])) {
      const multiplier5 = rowSymbols[0] === "big_win" ? 10 : 5;
      console.log(`Row ${rowIndex}: 5-in-a-row win detected with symbol "${rowSymbols[0]}" (multiplier: ${multiplier5}).`);
      totalMultiplier += multiplier5;
    } else {
      console.log(`Row ${rowIndex}: 5-in-a-row win condition not met.`);
    }
    
    // 3-in-a-row win: check for any three consecutive matching symbols.
    if (!pause3InRow && rowSymbols.length >= 3) {
      let foundThree = false;
      for (let i = 0; i <= rowSymbols.length - 3; i++) {
        if (rowSymbols[i] && rowSymbols[i] !== "undefined" && rowSymbols[i] !== "missing" &&
            rowSymbols[i] === rowSymbols[i+1] && rowSymbols[i] === rowSymbols[i+2]) {
          console.log(`Row ${rowIndex}: 3-in-a-row win detected at reels ${i}-${i+2} with symbol "${rowSymbols[i]}" (+2 multiplier).`);
          totalMultiplier += 2;
          foundThree = true;
          break;
        }
      }
      if (!foundThree) console.log(`Row ${rowIndex}: No 3-in-a-row win detected.`);
    }
    
    // 2-in-a-row win on the middle row (row 1): count each distinct consecutive pair.
    if (!pause2InRow && rowIndex === 1 && rowSymbols.length >= 2) {
      const validSymbols = rowSymbols.filter(s => s && s !== "undefined" && s !== "missing");
      console.log(`Row 1 valid symbols for 2-in-a-row: [${validSymbols.join(', ')}]`);
      let pairCount = 0;
      for (let i = 0; i < validSymbols.length - 1; i++) {
        if (validSymbols[i] === validSymbols[i+1]) {
          console.log(`Row 1: 2-in-a-row win at reels ${i} & ${i+1} with symbol "${validSymbols[i]}" (+0.25).`);
          totalMultiplier += 0.25;
          pairCount++;
        }
      }
      if (pairCount === 0) console.log("Row 1: No 2-in-a-row win detected.");
      else console.log(`Row 1: Detected ${pairCount} pair(s) (+${pairCount * 0.25} multiplier).`);
    }
  }

  console.log(`Total win multiplier: ${totalMultiplier}`);
  
  if (totalMultiplier > 0) {
    const betInput = document.getElementById("bet-input");
    const betAmount = betInput && !isNaN(parseFloat(betInput.value)) ? parseFloat(betInput.value) : 50;
    const winnings = betAmount * totalMultiplier;
    console.log(`Winnings calculated: ${winnings} MET (Bet: ${betAmount}, Multiplier: ${totalMultiplier}).`);
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
  const anim = document.createElement("div");
  anim.classList.add("particle-container");
  container.appendChild(anim);
  for (let i = 0; i < 30; i++) {
    const p = document.createElement("div");
    p.classList.add("particle");
    anim.appendChild(p);
    p.style.left = Math.random() * 100 + "%";
    p.style.animationDelay = Math.random() * 0.5 + "s";
  }
  setTimeout(() => { container.removeChild(anim); }, 2000);
}

/* ----- Wrap Original spin() Function ----- */
const originalSpin = window.spin;
window.spin = function(elem) {
  const betInput = document.getElementById("bet-input");
  const betAmount = betInput && !isNaN(parseFloat(betInput.value)) ? parseFloat(betInput.value) : 50;
  const totalAvailable = (window.initialDeposit || 0) + (window.offchainBalance || 0);
  console.log(`Before spin: Total available = ${totalAvailable} MET (Deposit: ${window.initialDeposit}, Play: ${window.offchainBalance}), Bet = ${betAmount} MET.`);
  if (totalAvailable < betAmount) {
    showMessage("Not enough tokens", false);
    return;
  }
  window.updateInGameBalance(-betAmount);
  originalSpin(elem);
};
