// public/game-logic.js

// For the free version, you might use a default starting value.
// For the paid version, we always use the backend off-chain balance.
const isPaidVersion = window.location.pathname.includes("paid-game.html");

// In the paid version, we do not use a separate "credits" variable;
// we rely on the backend to store and update the virtual balance.
// (For the free version, if desired, you could still have a static value.)

// Assume that when gameplay starts (in the paid version), the balance is loaded via wallet.js
// and displayed in the element with id "credits-display".

// Wrap the original setResult function provided by your reel animation engine:
const originalSetResult = window.setResult;
window.setResult = function() {
  originalSetResult();
  // After animations, check win conditions
  setTimeout(checkWin, 200);
};

async function checkWin() {
  const cols = document.querySelectorAll('.col');
  let results = [];
  cols.forEach(col => {
    const icons = col.querySelectorAll('.icon img');
    // Assume the visible middle icon is at index 1
    const src = icons[1].getAttribute('src');
    const parts = src.split('/');
    const fileName = parts[parts.length - 1];
    const iconName = fileName.split('.')[0];
    results.push(iconName);
  });

  let multiplier = 0;
  // 5-in-a-row win condition.
  if (results.every(icon => icon === results[0])) {
    multiplier = (results[0] === 'big_win') ? 10 : 5;
  } else {
    // 3 consecutive matching icons win condition.
    for (let i = 0; i <= results.length - 3; i++) {
      if (results[i] === results[i+1] && results[i] === results[i+2]) {
        multiplier = 2;
        break;
      }
    }
  }

  // Determine balance change based on win/loss
  if (multiplier > 0) {
    const winnings = parseFloat(document.getElementById("bet-input").value) * multiplier;
    // Notify the user and update the backend balance with a positive change.
    showMessage(`You win! +${winnings} MET`, true);
    await window.updateInGameBalance(winnings);
    triggerWinAnimation();
  } else {
    showMessage('You lose!', false);
  }
}

function showMessage(msg, isWin) {
  const messageDisplay = document.getElementById("message-display");
  if (!messageDisplay) return;
  messageDisplay.textContent = msg;
  messageDisplay.style.color = isWin ? 'green' : 'red';
  messageDisplay.style.opacity = 1;
  setTimeout(() => {
    messageDisplay.style.opacity = 0;
  }, 3000);
}

// Listen to bet input changes.
const betInput = document.getElementById("bet-input");
let bet = 50; // Default bet amount.
if (betInput) {
  betInput.addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10);
    bet = (!isNaN(val) && val > 0) ? val : 50;
  });
}

// Wrap the spin function to deduct the bet from the off-chain balance.
const originalSpin = window.spin;
window.spin = async function(elem) {
  // For the paid version, ensure wallet is connected.
  if (isPaidVersion && !window.userWallet) {
    showMessage("Please connect your wallet first.", false);
    return;
  }
  
  // Before spinning, deduct the bet amount from the off-chain balance.
  // Call updateInGameBalance with a negative value.
  await window.updateInGameBalance(-bet);
  
  // Call the original spin function (which triggers the outcome and calls setResult).
  originalSpin(elem);
};
