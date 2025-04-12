// public/game-logic.js

// Detect if this is the paid version by checking the URL. For paid version, use the off-chain balance.
let isPaidVersion = window.location.pathname.includes("paid-game.html");

// For the free version, we use a fixed default; for the paid version, the balance will be loaded via wallet.js.
let credits = isPaidVersion ? (window.offchainBalance || 0) : 1000;
let bet = 50;  // Default bet amount

// We'll update the UI using the element with id "credits-display"
const creditsDisplayElement = document.getElementById('credits-display');
const betInput = document.getElementById('bet-input');
const messageDisplay = document.getElementById('message-display');

// Function to update the displayed virtual credits.
function updateCreditsDisplay() {
  if (creditsDisplayElement) {
    creditsDisplayElement.innerText = credits;
  }
}

// Initially, update the display
updateCreditsDisplay();

// Wrap the original setResult function (assuming your reel animation engine provides it)
const originalSetResult = window.setResult;
window.setResult = function() {
  originalSetResult();
  // Wait a bit for the animations to settle, then check win conditions.
  setTimeout(checkWin, 200);
};

// Function to determine if the spin was a win and update credits accordingly.
function checkWin() {
  const cols = document.querySelectorAll('.col');
  let results = [];
  cols.forEach(col => {
    const icons = col.querySelectorAll('.icon img');
    // Assume the middle visible icon is at index 1
    const src = icons[1].getAttribute('src');
    // Extract the icon name from something like "items/apple.png"
    const parts = src.split('/');
    const fileName = parts[parts.length - 1];
    const iconName = fileName.split('.')[0];
    results.push(iconName);
  });

  let multiplier = 0;

  // Check for a 5-in-a-row win.
  if (results.every(icon => icon === results[0])) {
    multiplier = (results[0] === 'big_win') ? 10 : 5;
  } else {
    // Check for any 3 consecutive matching icons.
    for (let i = 0; i <= results.length - 3; i++) {
      if (results[i] === results[i+1] && results[i] === results[i+2]) {
        multiplier = 2;
        break;
      }
    }
  }

  if (multiplier > 0) {
    let winnings = bet * multiplier;
    credits += winnings;
    showMessage(`You win! +${winnings} credits`, true);
    triggerWinAnimation();
  } else {
    showMessage('You lose!', false);
  }

  // Update the UI and inform the backend for paid version.
  updateCreditsDisplay();
  if (isPaidVersion && window.updateInGameBalance) {
    window.updateInGameBalance(credits.toString());
  }
}

// Display win/loss messages.
function showMessage(msg, isWin) {
  if (!messageDisplay) return;
  messageDisplay.textContent = msg;
  messageDisplay.style.color = isWin ? 'green' : 'red';
  messageDisplay.style.opacity = 1;
  setTimeout(() => {
    messageDisplay.style.opacity = 0;
  }, 3000);
}

// Listen for changes in bet input.
if (betInput) {
  betInput.addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val > 0) {
      bet = val;
    } else {
      bet = 50;
      betInput.value = bet;
    }
  });
}

// Wrap the original spin function to deduct the bet from the off-chain credits.
const originalSpin = window.spin;
window.spin = function(elem) {
  // For the paid version, ensure the wallet is connected.
  if (isPaidVersion && !window.userWallet) {
    showMessage("Please connect your wallet first.", false);
    return;
  }
  
  // Check if the current balance is enough for the bet.
  if (credits < bet) {
    showMessage("Not enough credits!", false);
    return;
  }
  
  // Deduct the bet.
  credits -= bet;
  updateCreditsDisplay();
  if (isPaidVersion && window.updateInGameBalance) {
    window.updateInGameBalance(credits.toString());
  }
  
  // Clear previous messages.
  if (messageDisplay) { messageDisplay.textContent = ''; }
  
  // Call the original spin logic.
  originalSpin(elem);
};

// Initial display update.
updateCreditsDisplay();

// Trigger win animation (example implementation)
function triggerWinAnimation() {
  const container = document.getElementById('container');
  if (!container) return;
  const particleContainer = document.createElement('div');
  particleContainer.classList.add('particle-container');
  container.appendChild(particleContainer);
  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    particleContainer.appendChild(particle);
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 0.5 + 's';
  }
  setTimeout(() => {
    container.removeChild(particleContainer);
  }, 2000);
}
