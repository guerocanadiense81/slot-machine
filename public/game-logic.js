// public/game-logic.js

// Global toggles for win conditions (set to true to disable that win condition)
let pause5InRow = false;   // Full-row (all reels in a row match) win
let pause3InRow = false;   // Three consecutive match win anywhere in the row
let pause2InRow = false;   // Two consecutive match in the middle row win

/**
 * checkWin - Checks each row for win conditions:
 *   1. 5-in-a-row win (all reels in a row match): Multiplier is 10 for symbol "big_win" or 5 otherwise.
 *   2. 3-in-a-row win (any three consecutive reels in a row match): Multiplier = 2.
 *   3. 2-in-a-row win on the middle row (row index 1): Multiplier = 0.25.
 * Then it sums the multipliers and calculates winnings = bet × totalMultiplier.
 * Finally, it calls updateInGameBalance() with the winnings (a positive delta).
 */
function checkWin() {
  const reels = document.querySelectorAll('.col');
  let totalMultiplier = 0;
  
  console.log(`Checking win conditions over ${reels.length} reels.`);
  
  // Assume each reel shows 3 rows: indices 0, 1, 2.
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
    
    // 5-in-a-row win: all reels in this row have the same symbol.
    if (!pause5InRow && rowSymbols.length === reels.length && rowSymbols.every(s => s === rowSymbols[0])) {
      const multiplier5 = rowSymbols[0] === 'big_win' ? 10 : 5;
      console.log(`Row ${rowIndex}: Full match with symbol "${rowSymbols[0]}" (5-in-a-row) gives multiplier ${multiplier5}`);
      totalMultiplier += multiplier5;
    } else {
      console.log(`Row ${rowIndex}: Full match not achieved. Symbols: [${rowSymbols.join(', ')}]`);
    }
    
    // 3-in-a-row win: Check if any three consecutive reels match.
    if (!pause3InRow && rowSymbols.length >= 3) {
      let matched3 = false;
      for (let i = 0; i <= rowSymbols.length - 3; i++) {
        if (rowSymbols[i] && rowSymbols[i] === rowSymbols[i+1] && rowSymbols[i] === rowSymbols[i+2]) {
          console.log(`Row ${rowIndex}: 3-in-a-row match detected at reels ${i}-${i+2} with symbol "${rowSymbols[i]}" giving multiplier 2`);
          totalMultiplier += 2;
          matched3 = true;
          break; // Only count one instance per row.
        }
      }
      if (!matched3) {
        console.log(`Row ${rowIndex}: No 3-in-a-row match detected.`);
      }
    }
    
    // 2-in-a-row win: Only applied to the middle row (row index 1).
    if (!pause2InRow && rowIndex === 1 && rowSymbols.length >= 2) {
      let matched2 = false;
      for (let i = 0; i <= rowSymbols.length - 2; i++) {
        if (rowSymbols[i] && rowSymbols[i] === rowSymbols[i+1]) {
          console.log(`Middle row: 2-in-a-row match detected at reels ${i} and ${i+1} with symbol "${rowSymbols[i]}" giving multiplier 0.25`);
          totalMultiplier += 0.25;
          matched2 = true;
          break;  // Only count once.
        }
      }
      if (!matched2) {
        console.log("Middle row: No 2-in-a-row match detected.");
      }
    }
  }
  
  console.log(`Total win multiplier: ${totalMultiplier}`);
  
  if (totalMultiplier > 0) {
    const betInput = document.getElementById("bet-input");
    const betAmount = betInput && !isNaN(parseFloat(betInput.value)) ? parseFloat(betInput.value) : 50;
    const winnings = betAmount * totalMultiplier;
    console.log(`Calculated winnings: ${winnings} MET (Bet: ${betAmount} MET, Multiplier: ${totalMultiplier})`);
    if (typeof window.updateInGameBalance === "function") {
      window.updateInGameBalance(winnings);
    }
    showMessage(`You win! +${winnings} MET (Multiplier: ${totalMultiplier})`, true);
    triggerWinAnimation();
  } else {
    showMessage("You lose!", false);
  }
}

/* ---- UI Helper Functions ---- */
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

/* ---- Wrap Original Spin Function ---- */
// Assumes an original spin() function exists on the window.
const originalSpin = window.spin;
window.spin = function(elem) {
  // Instead of adjusting the deposit, we simply check that available funds are enough.
  // Total available = initialDeposit + offchainBalance.
  const totalAvailable = window.initialDeposit + window.offchainBalance;
  const betInput = document.getElementById("bet-input");
  const betAmount = betInput && !isNaN(parseFloat(betInput.value)) ? parseFloat(betInput.value) : 50;
  
  console.log(`Total available: ${totalAvailable} MET (Deposit: ${window.initialDeposit}, Play Balance: ${window.offchainBalance})`);
  
  if (totalAvailable < betAmount) {
    showMessage("Not enough tokens", false);
    return;
  }
  // Deduct the bet amount from the play (offchain) balance.
  window.updateInGameBalance(-betAmount);
  originalSpin(elem);
};
