// public/game-logic.js

// Check which version of the game is being run based on the URL.
let defaultCredits = 1000; // default for free version
if (window.location.pathname.includes("paid-game.html")) {
  // For paid version, we set the default credit to 0 until wallet connection loads the actual balance.
  defaultCredits = 0;
}

let credits = defaultCredits;  // in-game credit balance
let bet = 50;                  // Default bet amount for both versions

const creditsDisplayElement = document.getElementById('credits-display');
const betInput = document.getElementById('bet-input');
const messageDisplay = document.getElementById('message-display');

// Function to update the displayed credits.
function updateCreditsDisplay() {
  if (creditsDisplayElement) {
    creditsDisplayElement.textContent = credits;
  }
}

// Set the initial display based on the defaultCredits variable.
updateCreditsDisplay();

// Wrap original setResult function (assuming it exists in the reel engine code)
const originalSetResult = window.setResult;
window.setResult = function() {
  originalSetResult();
  // Delay win check to allow animations to settle
  setTimeout(checkWin, 200);
};

// Function to check win conditions and update credits accordingly.
function checkWin() {
  const cols = document.querySelectorAll('.col');
  let results = [];
  cols.forEach(col => {
    const icons = col.querySelectorAll('.icon img');
    // Assume the visible middle icon is at index 1
    const src = icons[1].getAttribute('src');
    // Extract the icon name, assuming a path like "items/apple.png"
    const parts = src.split('/');
    const fileName = parts[parts.length - 1];
    const iconName = fileName.split('.')[0];
    results.push(iconName);
  });

  let multiplier = 0;

  // Check for a "5 in a row" condition.
  if (results.every(icon => icon === results[0])) {
    multiplier = (results[0] === 'big_win') ? 10 : 5;
  } else {
    // Otherwise, check for any "3 consecutive matching" icons.
    for (let i = 0; i <= results.length - 3; i++) {
      if (results[i] === results[i+1] && results[i] === results[i+2]) {
        multiplier = 2;
        break;
      }
    }
  }

  if (multiplier > 0) {
    const winnings = bet * multiplier;
    credits += winnings;
    showMessage(`You win! +${winnings} credits`, true);
    triggerWinAnimation();
  } else {
    showMessage('You lose!', false);
  }

  updateCreditsDisplay();
}

// Function to display win/loss messages.
function showMessage(msg, isWin) {
  if (!messageDisplay) return;
  messageDisplay.textContent = msg;
  messageDisplay.style.color = isWin ? 'green' : 'red';
  messageDisplay.style.opacity = 1;
  setTimeout(() => {
    messageDisplay.style.opacity = 0;
  }, 3000);
}

// Listen for bet input changes.
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

// Wrap the original spin function for bet deduction and balance update.
const originalSpin = window.spin;
window.spin = function(elem) {
  // For the paid version, ensure wallet connection has been established.
  // For free version, credits are preset.
  if (window.location.pathname.includes("paid-game.html")) {
    // If paid version, check if wallet connection is available before allowing a spin.
    if (!window.userWallet) {
      showMessage("Please connect your wallet first.", false);
      return;
    }
  }
  
  // Check if there are enough credits to place the bet.
  if (credits < bet) {
    showMessage('Not enough credits!', false);
    return;
  }
  // Deduct the bet amount.
  credits -= bet;
  updateCreditsDisplay();
  // Clear any previous message.
  if (messageDisplay) {
    messageDisplay.textContent = '';
  }
  // Call the original spin function.
  originalSpin(elem);
};

// Initial display update.
updateCreditsDisplay();

// Particle effect on win (as before)
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
