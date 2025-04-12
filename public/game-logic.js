window.addEventListener('DOMContentLoaded', () => {
    let credits = 1000;
    let bet = 50;
    const creditsDisplay = document.getElementById('credits-display');
    const betInput = document.getElementById('bet-input');
    const messageDisplay = document.getElementById('message-display');

    function updateCreditsDisplay() {
        creditsDisplay.textContent = credits;
    }

    const originalSetResult = window.setResult;
    window.setResult = function() {
        originalSetResult();
        setTimeout(checkWin, 200);
    };

    function checkWin() {
        const cols = document.querySelectorAll('.col');
        let results = [];
        cols.forEach(col => {
            const icons = col.querySelectorAll('.icon img');
            const src = icons[1].getAttribute('src');
            const fileName = src.split('/').pop();
            const iconName = fileName.split('.')[0];
            results.push(iconName);
        });

        let multiplier = 0;
        if (results.every(icon => icon === results[0])) {
            multiplier = (results[0] === 'big_win') ? 10 : 5;
        } else {
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

    function showMessage(msg, isWin) {
        messageDisplay.textContent = msg;
        messageDisplay.style.color = isWin ? 'green' : 'red';
        messageDisplay.style.opacity = 1;
        setTimeout(() => { messageDisplay.style.opacity = 0; }, 3000);
    }

    betInput.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val > 0) {
            bet = val;
        } else {
            bet = 50;
            betInput.value = bet;
        }
    });

    const originalSpin = window.spin;
    window.spin = function(elem) {
        if (credits < bet) {
            showMessage('Not enough credits!', false);
            return;
        }
        credits -= bet;
        updateCreditsDisplay();
        messageDisplay.textContent = '';
        originalSpin(elem);
    };

    updateCreditsDisplay();
    
    function triggerWinAnimation() {
        const container = document.getElementById('container');
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
});
