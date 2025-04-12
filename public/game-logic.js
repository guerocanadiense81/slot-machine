// public/game-logic.js

// Global toggles for win conditions (set to true to disable that win condition)
let pause5InRow = false;   // Disable full-row wins if true.
let pause3InRow = false;   // Disable three consecutive matching wins if true.
let pause2InRow = false;   // Disable two-in-a-row wins on the middle row if true.

/**
 * checkWin:
 *   For each row (0, 1, 2), the function:
 *    - Checks if all reels in that row match (5-in-a-row win):
 *         * Multiplier is 10 if symbol is "big_win", else 5.
 *    - Checks for any three consecutive matching symbols (3-in-a-row win), multiplier +2.
 *    - For the middle row (row index 1) only, checks for any two consecutive matching symbols, multiplier +0.25.
 *   The total multiplier is summed across rows, and the winnings = bet * totalMultiplier.
 *   The winnings are then added to the off-chain virtual balance.
 */
function checkWin() {
  const reels = document.querySelectorAll('.col');
  let totalMultiplier = 0;
  
  console.log(`Checking win conditions on ${reels.length} reels.`);
  
  // Iterate rows; we assume each reel shows three rows: indices 0, 1, 2.
  for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
    let rowSymbols = [];
    
    reels.forEach((reel, reelIndex) => {
      const icons = reel.querySelectorAll('.icon img');
      if (icons.length > rowIndex) {
        let src = icons[rowIndex].getAttribute("src");
        let symbol = src.split('/').pop().split('.')[0];
        rowSymbols.push(symbol);
        console.log(`Reel ${reelIndex}, row ${rowIndex}: ${symbol}`);
      } else {
        console.warn(`Reel ${reelIndex} missing row ${rowIndex}`);
      }
    });
    
    // Check full row (5-in-a-row) win
    if (!pause5InRow && rowSymbols.length === reels.length && rowSymbols.every(s => s === rowSymbols[0])) {
      let multiplier = rowSymbols[0] === 'big_win' ? 10 : 5;
      console.log(`Row ${rowIndex} full match: symbol ${rowSymbols[0]} wins with multiplier ${multiplier}`);
      totalMultiplier += multiplier;
    } else {
      console.log(`Row ${rowIndex} full match failed. Symbols: [${rowSymbols.join(', ')}]`);
    }
    
    // Check 3-in-a-row win (any three consecutive reels)
    if (!pause3InRow && rowSymbols.length >= 3) {
      let win3 = false;
      for (let i = 0; i <= rowSymbols.length - 3; i++) {
        if (rowSymbols[i] && rowSymbols[i] === rowSymbols[i+1] && rowSymbols[i] === rowSymbols[i+2]) {
          console.log(`Row ${rowIndex} 3-in-a-row win at reels ${i}-${i+2} with symbol ${rowSymbols[i]}, +2 multiplier`);
          totalMultiplier += 2;
          win3 = true;
          break;  // Count only one instance per row.
        }
      }
      if (!win3) console.log(`Row ${rowIndex} did not qualify for 3-in-a-row win.`);
    }
    
    // Check 2-in-a-row win on the middle row (rowIndex === 1)
    if (!pause2InRow && rowIndex === 1 && rowSymbols.length >= 2) {
      let win2 = false;
      for (let i = 0; i <= rowSymbols.length - 2; i++) {
        if (rowSymbols[i] && rowSymbols[i] === rowSymbols[i+1]) {
          console.log(`Middle row 2-in-a-row win at reels ${i} and ${i+1} with symbol ${rowSymbols[i]}, +0.25 multiplier`);
          totalMultiplier += 0.25;
          win2 = true;
          break;
        }
      }
      if (!win2) console.log(`Middle row did not qualify for 2-in-a-row win.`);
    }
  }
  
  console.log(`Total multiplier calculated: ${totalMultiplier}`);
  
  // If win conditions met, calculate winnings.
  if (totalMultiplier > 0) {
    const betInput = document.getElementById("bet-input");
    const betAmount = betInput && !isNaN(parseFloat(betInput.value)) ? parseFloat(betInput.value) : 50;
    const winnings = betAmount * totalMultiplier;
    console.log(`Winnings: ${winnings} MET (bet ${betAmount} MET, multiplier ${totalMultiplier})`);
    
    // Add the winnings to off-chain balance
    if (typeof window.updateInGameBalance === "function") {
      window.updateInGameBalance(winnings);
    }
    showMessage(`You win! +${winnings} MET (Multiplier: ${totalMultiplier})`, true);
    triggerWinAnimation();
  } else {
    showMessage("You lose!", false);
  }
}

/* ---- Placeholder Functions ---- */
function showMessage(msg, isWin) {
  const msgElem = document.getElementById("message-display");
  if (msgElem) {
    msgElem.textContent = msg;
    msgElem.style.color = isWin ? "green" : "red";
    msgElem.style.opacity = 1;
    setTimeout(() => { msgElem.style.opacity = 0; }, 3000);
  }
}

function triggerWinAnimation() {
  const container = document.getElementById("container");
  if (!container) return;
  const animElem = document.createElement("div");
  animElem.classList.add("particle-container");
  container.appendChild(animElem);
  for (let i = 0; i < 30; i++) {
    const p = document.createElement("div");
    p.classList.add("particle");
    animElem.appendChild(p);
    p.style.left = Math.random() * 100 + "%";
    p.style.animationDelay = Math.random() * 0.5 + "s";
  }
  setTimeout(() => {
    container.removeChild(animElem);
  }, 2000);
}

/* ---- Spin Wrapper: Deduct Bet Using Total Available Funds ---- */
const originalSpin = window.spin;
window.spin = function(elem) {
  // Determine total available tokens:
  // Total = locked deposit + offchain net balance.
  let totalAvailable = window.initialDeposit + window.offchainBalance;
  const betInput = document.getElementById("bet-input");
  const betAmount = betInput && !isNaN(parseFloat(betInput.value)) ? parseFloat(betInput.value) : 50;
  
  console.log(`Total available tokens: ${totalAvailable} MET (Deposit: ${window.initialDeposit}, Balance: ${window.offchainBalance})`);
  
  if (totalAvailable < betAmount) {
    showMessage("Not enough tokens", false);
    return;
  }
  
  // If offchainBalance is insufficient but total is enough, "transfer" the shortfall from the deposit.
  if (window.offchainBalance < betAmount) {
    let shortfall = betAmount - window.offchainBalance;
    console.log(`Shortfall detected: ${shortfall} MET. Adjusting deposit to cover bet.`);
    // Deduct shortfall from initialDeposit and add it to offchainBalance.
    window.initialDeposit = Math.max(window.initialDeposit - shortfall, 0);
    window.offchainBalance += shortfall;
    console.log(`New values - Deposit: ${window.initialDeposit}, Balance: ${window.offchainBalance}`);
  }
  
  // Deduct the bet amount from offchain balance.
  window.updateInGameBalance(-betAmount);
  originalSpin(elem);
};
