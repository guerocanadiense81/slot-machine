// public/game-logic.js

// ——————— CONFIG ———————
// You can modify these values at runtime (or hook them up to UI inputs)
const WIN_CONFIG = {
  forcedWinChance: 0.01,       // 1% chance to force a win
  multiplier5: 1,              // 5-in-a-row (non–big_win)
  multiplier5Big: 1.5,         // 5-in-a-row when symbol === 'big_win'
  multiplier3: 0.5,            // any 3-in-a-row
  multiplier2: 0.05            // each 2-in-a-row in the middle row
};

// ——————— END CONFIG ———————

const SYMBOLS = [
  "cherry", "lemon", "big_win",
  "banana","grapes","orange",
  "pear","strawberry","watermelon",
  "lucky_seven"
];

const NUM_REELS = 5;
const NUM_ROWS = 3;
const animationDuration = 3000; // match your CSS

function spin() {
  const betInput = document.getElementById("bet-input");
  const betAmount = betInput && !isNaN(+betInput.value) ? +betInput.value : 50;

  // Check balance
  const totalAvailable = (window.initialDeposit||0) + (window.offchainBalance||0);
  if (totalAvailable < betAmount) {
    return showMessage("Not enough tokens", false);
  }
  window.updateInGameBalance(-betAmount);

  const container = document.getElementById("container");
  container.classList.add("spinning");

  setTimeout(() => {
    const outcome = generateOutcome();
    renderOutcome(outcome);
    container.classList.remove("spinning");
    calculateWin(outcome, betAmount);
  }, animationDuration);
}

function generateOutcome() {
  const out = Array.from({length: NUM_REELS}, () =>
    Array.from({length: NUM_ROWS}, () =>
      SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)])
  );

  // Forced win?
  if (Math.random() < WIN_CONFIG.forcedWinChance) {
    const type = Math.floor(Math.random()*3);
    if (type === 0) force5InRow(out);
    else if (type === 1) force3InRow(out);
    else force2InRow(out);
  }
  return out;
}

function force5InRow(out) {
  const row = Math.floor(Math.random()*NUM_ROWS);
  const sym = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
  for (let r=0;r<NUM_REELS;r++) out[r][row] = sym;
  console.log(`Forced 5‑in‑a‑row on row ${row} with ${sym}`);
}

function force3InRow(out) {
  const row = Math.floor(Math.random()*NUM_ROWS);
  const start = Math.floor(Math.random()*(NUM_REELS-2));
  const sym = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
  for (let i=start;i<start+3;i++) out[i][row]=sym;
  console.log(`Forced 3‑in‑a‑row on row ${row}, reels ${start}-${start+2} with ${sym}`);
}

function force2InRow(out) {
  const sym = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
  const start = Math.floor(Math.random()*(NUM_REELS-1));
  out[start][1] = sym;
  out[start+1][1] = sym;
  console.log(`Forced 2‑in‑a‑row on middle row at reels ${start},${start+1} with ${sym}`);
}

function renderOutcome(outcome) {
  const cols = document.querySelectorAll(".col");
  outcome.forEach((colArr, i) => {
    colArr.forEach((sym, j) => {
      const img = cols[i].querySelectorAll(".icon img")[j];
      img.src = `items/${sym}.png`;
      img.alt = sym;
    });
  });
}

function calculateWin(outcome, bet) {
  let totalMult = 0;

  outcome[0].forEach((_, row) => {
    const rowSyms = outcome.map(col=>col[row]);

    // 5‑in‑a‑row
    if (rowSyms.every(s=>s===rowSyms[0])) {
      totalMult += (rowSyms[0]==="big_win"
        ? WIN_CONFIG.multiplier5Big
        : WIN_CONFIG.multiplier5);
    }

    // 3‑in‑a‑row
    for (let i=0;i<=rowSyms.length-3;i++){
      if (rowSyms[i]===rowSyms[i+1]&&rowSyms[i]===rowSyms[i+2]) {
        totalMult+=WIN_CONFIG.multiplier3;
        break;
      }
    }

    // 2‑in‑a‑row on middle
    if (row===1){
      for (let i=0;i<rowSyms.length-1;i++){
        if (rowSyms[i]===rowSyms[i+1]){
          totalMult+=WIN_CONFIG.multiplier2;
        }
      }
    }
  });

  if (totalMult>0){
    const winAmt = bet*totalMult;
    window.updateInGameBalance(winAmt);
    showMessage(`You win! +${winAmt} MET`, true);
    triggerWinAnimation();
  } else {
    showMessage("You lose!", false);
  }
}

function showMessage(msg, win){
  const d = document.getElementById("message-display");
  d.textContent = msg;
  d.style.color = win?"green":"red";
  d.style.opacity = 1;
  setTimeout(()=>d.style.opacity=0,3000);
}

function triggerWinAnimation(){
  const c = document.getElementById("container");
  const pc = document.createElement("div");
  pc.classList.add("particle-container");
  c.appendChild(pc);
  for (let i=0;i<30;i++){
    const p = document.createElement("div");
    p.classList.add("particle");
    pc.appendChild(p);
    p.style.left = Math.random()*100+"%";
    p.style.animationDelay = Math.random()*0.5+"s";
  }
  setTimeout(()=>c.removeChild(pc),2000);
}

// Expose spin to global
window.spin = spin;
