/**
 * @file game.js
 * @description Controls the entire slot machine game logic, including state management,
 * spinning, win calculation, and UI updates for both free and paid modes.
 */
const CONFIG = {
    NUM_REELS: 5,
    NUM_ICONS_PER_REEL: 20, // How many icons to generate for the spin animation
    SYMBOLS: [
        "apple", "apricot", "banana", "big_win", "cherry", "grapes", "lemon", 
        "lucky_seven", "orange", "pear", "strawberry", "watermelon"
    ],
    WIN_CONFIG: {
        forcedWinChance: 0.05,
        multipliers: {
            fiveInRow: 5,
            fiveInRowBigWin: 10,
            threeInRow: 1.5
        }
    }
};

const gameState = {
    isSpinning: false,
    betAmount: 50
};

const SlotMachine = {
    init() {
        this.cacheDOMElements();
        this.attachEventListeners();
        this.setupInitialReels();
        window.Wallet.init();
    },

    cacheDOMElements() {
        this.dom = {
            container: document.getElementById('container'),
            spinButton: document.querySelector('.start-button'),
            betInput: document.getElementById('bet-input'),
            messageDisplay: document.getElementById('message-display'),
            reelColumns: document.querySelectorAll('.col')
        };
    },

    attachEventListeners() {
        this.dom.spinButton.addEventListener('click', () => this.spin());
        this.dom.betInput.addEventListener('change', (e) => {
            gameState.betAmount = parseFloat(e.target.value) || 50;
        });
    },

    setupInitialReels() {
        this.dom.reelColumns.forEach(col => {
            col.innerHTML = ''; // Clear previous
            const wrapper = document.createElement('div');
            wrapper.className = 'icons-wrapper';

            for (let i = 0; i < CONFIG.NUM_ICONS_PER_REEL; i++) {
                wrapper.appendChild(this.createIcon(this.getRandomSymbol()));
            }
            col.appendChild(wrapper);
        });
    },

    createIcon(symbol) {
        const iconEl = document.createElement('div');
        iconEl.className = 'icon';
        iconEl.innerHTML = `<img src="items/${symbol}.png" alt="${symbol}" />`;
        return iconEl;
    },

    async spin() {
        if (gameState.isSpinning) return;

        gameState.betAmount = parseFloat(this.dom.betInput.value);
        if (!window.Wallet.checkBalance(gameState.betAmount)) {
            this.showMessage("Not enough credits!", false);
            return;
        }

        gameState.isSpinning = true;
        this.dom.spinButton.disabled = true;
        this.showMessage("Spinning...", true);
        await window.Wallet.updateBalance(-gameState.betAmount);

        // Reset reels to a random start for the animation
        this.dom.reelColumns.forEach((col, index) => {
            const wrapper = col.querySelector('.icons-wrapper');
            wrapper.style.transition = 'none';
            wrapper.style.transform = `translateY(0)`;
            // Trigger reflow
            wrapper.offsetHeight; 
            // Add transition back
            wrapper.style.transition = `transform ${3 + index * 0.2}s cubic-bezier(0.65, 0, 0.35, 1)`;
        });

        const outcome = this.generateReelOutcome();
        this.dom.container.classList.add('spinning');
        
        setTimeout(() => {
            this.dom.container.classList.remove('spinning');
            gameState.isSpinning = false;
            this.dom.spinButton.disabled = false;
            this.updateReels(outcome); // Show final result
            this.calculateWin(outcome);
        }, 3500);
    },

    updateReels(outcome) {
        this.dom.reelColumns.forEach((col, i) => {
            const wrapper = col.querySelector('.icons-wrapper');
            // Replace the top icons with the winning ones for a seamless stop
            const topIcons = wrapper.querySelectorAll('.icon');
            topIcons[0].innerHTML = `<img src="items/${outcome[i][0]}.png" alt="${outcome[i][0]}" />`;
            topIcons[1].innerHTML = `<img src="items/${outcome[i][1]}.png" alt="${outcome[i][1]}" />`;
            topIcons[2].innerHTML = `<img src="items/${outcome[i][2]}.png" alt="${outcome[i][2]}" />`;
        });
    },

    generateReelOutcome() {
        const reels = Array.from({ length: CONFIG.NUM_REELS }, () =>
            Array.from({ length: 3 }, () => this.getRandomSymbol())
        );
        // Force win logic can be added here if needed
        return reels;
    },

    async calculateWin(outcome) {
        let totalMultiplier = 0;
        // Check middle row for wins
        const middleRow = outcome.map(reel => reel[1]);
        
        if (middleRow.every(s => s === middleRow[0])) { // 5-in-a-row
            totalMultiplier = middleRow[0] === 'big_win' ? CONFIG.WIN_CONFIG.multipliers.fiveInRowBigWin : CONFIG.WIN_CONFIG.multipliers.fiveInRow;
        } else { // Check for 3-in-a-row
            for (let i = 0; i <= middleRow.length - 3; i++) {
                if (middleRow[i] === middleRow[i + 1] && middleRow[i] === middleRow[i + 2]) {
                    totalMultiplier = CONFIG.WIN_CONFIG.multipliers.threeInRow;
                    break;
                }
            }
        }

        if (totalMultiplier > 0) {
            const winnings = gameState.betAmount * totalMultiplier;
            await window.Wallet.updateBalance(winnings);
            this.showMessage(`You won ${winnings.toFixed(2)}!`, true);
        } else {
            this.showMessage("Better luck next time!", false);
        }
    },

    showMessage(msg, isPositive) {
        this.dom.messageDisplay.textContent = msg;
        this.dom.messageDisplay.style.color = isPositive ? "lime" : "tomato";
    },

    getRandomSymbol() {
        return CONFIG.SYMBOLS[Math.floor(Math.random() * CONFIG.SYMBOLS.length)];
    }
};

document.addEventListener('DOMContentLoaded', () => {
    SlotMachine.init();
});