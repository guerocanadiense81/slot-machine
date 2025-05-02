// public/game-logic.js

// ———— CONFIGURATION ————
// Tweak these values as you like:
const WIN_CONFIG = {
  forcedWinChance: 0.01,    // 1% chance to force a win layout
  multiplier5: 1.5,           // 5‑in‑a‑row (normal symbol)
  multiplier5Big: 3,      // 5‑in‑a‑row if symbol === "big_win"
  multiplier3: 1,         // any 3‑in‑a‑row
  multiplier2: 0.1         // each 2‑in‑a‑row in the middle row
};
// ————————————————

window.addEventListener('DOMContentLoaded', () => {
  // Grab references to UI elements
  const creditsDisplay = document.getElementById('credits-display');
  const betInput       = document.getElementById('bet-input');
  const messageDisplay = document.getElementById('message-display');

  // Wrap the original setResult defined in script.js
  const originalSetResult = window.setResult;
  window.setResult = function() {
    originalSetResult();
    // After the result is placed in the DOM, run our check
    setTimeout(checkWin, 100); // slight delay to ensure DOM updated
  };

  // Override spin to deduct bet immediately (preserves original spin)
  const originalSpin = window.spin;
  window.spin = function(elem) {
    const betAmt = parseFloat(betInput.value) || 50;
    if ( (window.initialDeposit||0) + (window.offchainBalance||0) < betAmt ) {
      showMessage('Not enough tokens', false);
      return;
    }
    // Deduct bet off‑chain
    if (typeof window.updateInGameBalance === 'function') {
      window.updateInGameBalance(-betAmt);
    }
    originalSpin(elem);
  };

  function showMessage(msg, isWin) {
    messageDisplay.textContent = msg;
    messageDisplay.style.color   = isWin ? 'green' : 'red';
    messageDisplay.style.opacity = 1;
    setTimeout(() => messageDisplay.style.opacity = 0, 3000);
  }

  function getVisibleSymbols() {
    // Middle icon (row index 1) of each reel
    return Array.from(document.querySelectorAll('.col')).map(col => {
      const img = col.querySelectorAll('.icon img')[1];
      if (!img) return undefined;
      const filename = img.getAttribute('src').split('/').pop();
      return filename.split('.')[0];
    });
  }

  function checkWin() {
    const results = getVisibleSymbols();
    console.log('Visible results:', results);

    // 1) Optionally force a win layout
    if (Math.random() < WIN_CONFIG.forcedWinChance) {
      forceWinLayout(results);
      // Re-render forced layout
      applyLayout(results);
      console.log('Forced win layout applied:', results);
    }

    // Now calculate multipliers
    let totalMult = 0;

    // --- 5‑in‑a‑row ---
    if (results.every(s => s === results[0])) {
      const sym = results[0];
      const m = (sym === 'big_win')
                ? WIN_CONFIG.multiplier5Big
                : WIN_CONFIG.multiplier5;
      console.log(`5‑in‑a‑row on "${sym}", x${m}`);
      totalMult += m;
    }

    // --- 3‑in‑a‑row (any consecutive three) ---
    for (let i = 0; i <= results.length - 3; i++) {
      if (results[i] && results[i] === results[i+1] && results[i] === results[i+2]) {
        console.log(`3‑in‑a‑row at ${i}‑${i+2} on "${results[i]}", +${WIN_CONFIG.multiplier3}`);
        totalMult += WIN_CONFIG.multiplier3;
        break;
      }
    }

    // --- 2‑in‑a‑row on middle row (row index 1) ---
    // (we’re only looking at the middle visible row, so same array)
    for (let i = 0; i < results.length - 1; i++) {
      if (results[i] && results[i] === results[i+1]) {
        console.log(`2‑in‑a‑row at ${i}&${i+1} on "${results[i]}", +${WIN_CONFIG.multiplier2}`);
        totalMult += WIN_CONFIG.multiplier2;
      }
    }

    // Payout or loss
    const betAmt = parseFloat(betInput.value) || 50;
    if (totalMult > 0) {
      const winAmt = betAmt * totalMult;
      console.log(`Total multiplier: ${totalMult}, payout: ${winAmt}`);
      window.updateInGameBalance(winAmt);
      showMessage(`You win! +${winAmt} MET`, true);
      triggerWinAnimation();
    } else {
      showMessage('You lose!', false);
    }
  }

  function forceWinLayout(arr) {
    // Prefer a full 5‑in‑a‑row if possible
    const sym = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
    for (let i = 0; i < arr.length; i++) arr[i] = sym;
  }

  function applyLayout(arr) {
    // Sets the middle visible icon of each reel to arr[i]
    const cols = document.querySelectorAll('.col');
    arr.forEach((sym, i) => {
      const img = cols[i].querySelectorAll('.icon img')[1];
      if (img) img.src = `items/${sym}.png`;
    });
  }

  // Particle effect on win (unchanged)
  function triggerWinAnimation() {
    const container = document.getElementById('container');
    const pc = document.createElement('div');
    pc.classList.add('particle-container');
    container.appendChild(pc);
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.classList.add('particle');
      pc.appendChild(p);
      p.style.left = Math.random()*100 + '%';
      p.style.animationDelay = Math.random()*0.5 + 's';
    }
    setTimeout(() => container.removeChild(pc), 2000);
  }

  // Expose for debugging
  window.WIN_CONFIG = WIN_CONFIG;
});
