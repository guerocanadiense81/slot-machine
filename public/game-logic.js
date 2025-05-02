// public/game-logic.js

// ——— CONFIGURATION ———
// Tweak these values to change payouts or win rates:
const WIN_CONFIG = {
  forcedWinChance: 0.05,      // 5% chance to force a win configuration
  multipliers: {
    fiveInRow: 2,             // base multiplier for any 5-in-a-row
    fiveInRowBigWin: 3,       // multiplier when the symbol is "big_win"
    threeInRow: 1,            // added multiplier for any 3-in-a-row
    twoInRow: 0.5             // added multiplier per 2-in-a-row pair on middle row
  }
};
// ————————————————————

const SYMBOLS = [
  "cherry","lemon","big_win","banana","grapes",
  "orange","pear","strawberry","watermelon","lucky_seven"
];

const NUM_REELS = 5;
const NUM_ROWS  = 3;
const animationDuration = 3000; // Must match your CSS

/**
 * Called when the Spin button is clicked.
 * Deduct bet, animate, generate outcome, update DOM, then calculate wins.
 */
function spin(elem) {
  const betInput = document.getElementById("bet-input");
  const betAmount = betInput && !isNaN(parseFloat(betInput.value))
    ? parseFloat(betInput.value)
    : 50;

  // Ensure enough off-chain balance
  const totalAvailable = (window.initialDeposit || 0) + (window.offchainBalance || 0);
  if (totalAvailable < betAmount) {
    showMessage("Not enough tokens", false);
    return;
  }

  // Deduct bet
  if (window.updateInGameBalance) window.updateInGameBalance(-betAmount);

  // Trigger CSS spin
  const container = document.getElementById("container");
  container.classList.add("spinning");
  console.log("Spin started; animation applied.");

  setTimeout(() => {
    // 1) Generate random outcome
    const outcome = Array.from({ length: NUM_REELS }, () =>
      Array.from({ length: NUM_ROWS }, () =>
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
      )
    );

    // 2) Optional forced win
    if (Math.random() < WIN_CONFIG.forcedWinChance) {
      const winType = Math.floor(Math.random() * 3);
      if (winType === 0) {
        // 5-in-a-row
        const row = Math.floor(Math.random() * NUM_ROWS);
        const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        for (let r = 0; r < NUM_REELS; r++) outcome[r][row] = sym;
        console.log(`Forced 5-in-row on row ${row} of ${sym}`);
      } else if (winType === 1) {
        // 3-in-a-row
        const row = Math.floor(Math.random() * NUM_ROWS);
        const start = Math.floor(Math.random() * (NUM_REELS - 2));
        const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        for (let r = start; r < start + 3; r++) outcome[r][row] = sym;
        console.log(`Forced 3-in-row on row ${row}, reels ${start}–${start+2}`);
      } else {
        // 2-in-a-row in middle row
        const start = Math.floor(Math.random() * (NUM_REELS - 1));
        const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        outcome[start][1] = sym;
        outcome[start + 1][1] = sym;
        console.log(`Forced 2-in-row on middle row at reels ${start} & ${start+1}`);
      }
    }

    // 3) Update the DOM images
    document.querySelectorAll('.col').forEach((colEl, i) => {
      colEl.querySelectorAll('.icon img').forEach((imgEl, j) => {
        imgEl.src = `items/${outcome[i][j]}.png`;
        imgEl.alt = outcome[i][j];
      });
    });

    container.classList.remove("spinning");
    console.log("Outcome:", outcome);

    // 4) Calculate win from the same outcome array
    calculateWin(outcome, betAmount);
  }, animationDuration);
}


/**
 * Uses the outcome array to compute totalMultiplier based on WIN_CONFIG,
 * then pays out or shows a loss.
 */
function calculateWin(outcome, betAmount) {
  let totalMultiplier = 0;

  for (let row = 0; row < NUM_ROWS; row++) {
    const rowSymbols = outcome.map(reel => reel[row]);
    console.log(`Row ${row}`, rowSymbols);

    // 5‑in‑a‑row?
    if (rowSymbols.every(s => s === rowSymbols[0])) {
      const base  = WIN_CONFIG.multipliers.fiveInRow;
      const extra = rowSymbols[0] === "big_win" ? WIN_CONFIG.multipliers.fiveInRowBigWin : base;
      console.log(`→ 5-in-row: +${extra}`);
      totalMultiplier += extra;
    }

    // 3‑in‑a‑row?
    for (let i = 0; i <= rowSymbols.length - 3; i++) {
      if (rowSymbols[i] === rowSymbols[i+1] && rowSymbols[i] === rowSymbols[i+2]) {
        console.log(`→ 3-in-row: +${WIN_CONFIG.multipliers.threeInRow}`);
        totalMultiplier += WIN_CONFIG.multipliers.threeInRow;
        break;
      }
    }

    // 2‑in‑a‑row on middle row?
    if (row === 1) {
      let pairs = 0;
      for (let i = 0; i < rowSymbols.length - 1; i++) {
        if (rowSymbols[i] === rowSymbols[i+1]) {
          console.log(`→ 2-in-row: +${WIN_CONFIG.multipliers.twoInRow}`);
          totalMultiplier += WIN_CONFIG.multipliers.twoInRow;
          pairs++;
        }
      }
      if (pairs) console.log(`   (${pairs} pairs)`);
    }
  }

  console.log("Total multiplier:", totalMultiplier);

  if (totalMultiplier > 0) {
    const winnings = betAmount * totalMultiplier;
    console.log(`Payout ${winnings} MET`);
    if (window.updateInGameBalance) window.updateInGameBalance(winnings);
    showMessage(`You win! +${winnings} MET`, true);
    triggerWinAnimation();
  } else {
    showMessage("You lose!", false);
  }
}


/* ——— Helpers ——— */
function showMessage(msg, isWin) {
  const d = document.getElementById("message-display");
  if (!d) return;
  d.textContent = msg;
  d.style.color   = isWin ? "green" : "red";
  d.style.opacity = 1;
  setTimeout(() => { d.style.opacity = 0; }, 3000);
}

function triggerWinAnimation() {
  const c = document.getElementById("container");
  if (!c) return;
  const pc = document.createElement("div");
  pc.classList.add("particle-container");
  c.appendChild(pc);
  for (let i = 0; i < 30; i++) {
    const p = document.createElement("div");
    p.classList.add("particle");
    pc.appendChild(p);
    p.style.left           = Math.random() * 100 + "%";
    p.style.animationDelay = Math.random() * 0.5 + "s";
  }
  setTimeout(() => c.removeChild(pc), 2000);
}
