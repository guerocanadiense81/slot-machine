/**
 * @file game.js
 * @description Final version with realistic, multi-stage spin animation.
 */
const CONFIG = {
    NUM_REELS: 5,
    // A longer icon strip creates a better spinning illusion
    NUM_ICONS_PER_REEL: 30,
    SYMBOLS: [
        "apple", "apricot", "banana", "big_win", "cherry", "grapes", "lemon",
        "lucky_seven", "orange", "pear", "strawberry", "watermelon"
    ],
    WIN_CONFIG: {
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
        // Assuming wallet.js is loaded and provides a global Wallet object
        if (window.Wallet) {
            window.Wallet.init();
        }
    },

    cacheDOMElements() {
        this.dom = {
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

    // Creates the icon elements for each reel
    setupInitialReels() {
        this.dom.reelColumns.forEach(col => {
            col.innerHTML = '';
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

    // Generates the final 3-row outcome for the reels
    generateReelOutcome() {
        return Array.from({ length: CONFIG.NUM_REELS }, () =>
            Array.from({ length: 3 }, () => this.getRandomSymbol())
        );
    },

    /**
     * The main spin handler with multi-stage animation logic.
     */
    async spin() {
        if (gameState.isSpinning) return;
        gameState.isSpinning = true;
        this.dom.spinButton.disabled = true;
        this.showMessage("Spinning...", true);

        // Deduct bet amount (assuming a Wallet object exists)
        gameState.betAmount = parseFloat(this.dom.betInput.value);
        if (window.Wallet && !window.Wallet.checkBalance(gameState.betAmount)) {
            this.showMessage("Not enough credits!", false);
            gameState.isSpinning = false;
            this.dom.spinButton.disabled = false;
            return;
        }
        if (window.Wallet) {
            await window.Wallet.updateBalance(-gameState.betAmount);
        }

        const outcome = this.generateReelOutcome();

        // 1. Start each reel spinning with a delay
        for (let i = 0; i < CONFIG.NUM_REELS; i++) {
            setTimeout(() => {
                const reel = this.dom.reelColumns[i];
                this.prepareReelForSpin(reel, outcome[i]);
                reel.classList.add('spinning', 'blur');
            }, i * 150); // Staggered start
        }

        // 2. Stop each reel sequentially
        for (let i = 0; i < CONFIG.NUM_REELS; i++) {
            setTimeout(() => {
                this.stopReel(this.dom.reelColumns[i]);
            }, 2000 + (i * 500)); // Staggered stop
        }

        // 3. Finalize after the last reel stops
        setTimeout(() => {
            gameState.isSpinning = false;
            this.dom.spinButton.disabled = false;
            this.calculateWin(outcome);
        }, 2000 + (CONFIG.NUM_REELS * 500));
    },

    /**
     * Resets the reel and loads the winning icons at the end of the icon strip.
     */
    prepareReelForSpin(reel, finalSymbols) {
        const wrapper = reel.querySelector('.icons-wrapper');
        // Reset transform without transition to prepare for animation
        wrapper.style.transition = 'none';
        wrapper.style.transform = 'translateY(0)';
        
        // Replace the last 3 icons with the final outcome
        const icons = wrapper.querySelectorAll('.icon');
        for (let j = 0; j < 3; j++) {
            const iconImg = icons[icons.length - 3 + j].querySelector('img');
            iconImg.src = `items/${finalSymbols[j]}.png`;
            iconImg.alt = finalSymbols[j];
        }
    },

    /**
     * Stops a single reel, removes animation classes, and lands it on the result.
     */
    stopReel(reel) {
        reel.classList.remove('spinning');
        
        // After a short delay to let it land, remove the blur
        setTimeout(() => {
            reel.classList.remove('blur');
        }, 500); // Keep blur during the "thud" animation
    },

    async calculateWin(outcome) {
        let totalMultiplier = 0;
        const middleRow = outcome.map(reel => reel[1]); // Win line is the middle row

        if (middleRow.every(s => s === middleRow[0])) {
            totalMultiplier = middleRow[0] === 'big_win' ? CONFIG.WIN_CONFIG.multipliers.fiveInRowBigWin : CONFIG.WIN_CONFIG.multipliers.fiveInRow;
        } else {
            for (let i = 0; i <= middleRow.length - 3; i++) {
                if (middleRow[i] === middleRow[i + 1] && middleRow[i] === middleRow[i + 2]) {
                    totalMultiplier = CONFIG.WIN_CONFIG.multipliers.threeInRow;
                    break;
                }
            }
        }

        if (totalMultiplier > 0) {
            const winnings = gameState.betAmount * totalMultiplier;
            if (window.Wallet) await window.Wallet.updateBalance(winnings);
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