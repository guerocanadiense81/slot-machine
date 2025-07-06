/**
 * @file game.js
 * @description Final version with corrected random landing logic.
 */
const CONFIG = {
    NUM_REELS: 5,
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

    generateReelOutcome() {
        return Array.from({ length: CONFIG.NUM_REELS }, () =>
            Array.from({ length: 3 }, () => this.getRandomSymbol())
        );
    },

    async spin() {
        if (gameState.isSpinning) return;
        gameState.isSpinning = true;
        this.dom.spinButton.disabled = true;
        this.showMessage("Spinning...", true);

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

        for (let i = 0; i < CONFIG.NUM_REELS; i++) {
            const reel = this.dom.reelColumns[i];
            const finalSymbols = outcome[i];
            
            this.prepareReelForSpin(reel, finalSymbols);

            // Stagger the start of each reel's spin
            setTimeout(() => {
                reel.classList.add('spinning', 'blur');
            }, i * 150);
        }

        for (let i = 0; i < CONFIG.NUM_REELS; i++) {
            // Stagger the stop of each reel
            setTimeout(() => {
                this.stopReel(this.dom.reelColumns[i]);
            }, 2000 + (i * 500));
        }

        // Finalize after the last reel has stopped
        setTimeout(() => {
            gameState.isSpinning = false;
            this.dom.spinButton.disabled = false;
            this.calculateWin(outcome);
        }, 2000 + (CONFIG.NUM_REELS * 500));
    },
    
    prepareReelForSpin(reel, finalSymbols) {
        const wrapper = reel.querySelector('.icons-wrapper');
        
        // Reset transform and transition to prepare for a new spin animation
        wrapper.style.transition = 'none';
        wrapper.style.transform = 'translateY(0)';
        
        // Replace the icons at the END of the strip with the new random result
        const icons = wrapper.querySelectorAll('.icon');
        for (let j = 0; j < 3; j++) {
            const iconImg = icons[icons.length - 3 + j].querySelector('img');
            iconImg.src = `items/${finalSymbols[j]}.png`;
            iconImg.alt = finalSymbols[j];
        }
    },

    /**
     * THIS IS THE CORRECTED FUNCTION
     * Stops a single reel and explicitly sets its final position.
     */
    stopReel(reel) {
        const wrapper = reel.querySelector('.icons-wrapper');
        
        // Calculate the final position where the winning icons are visible
        const finalPosition = `translateY(calc(-100% + 300px))`;
        
        // Remove the infinite spinning animation class
        reel.classList.remove('spinning');
        
        // Set the final transform. The transition in the CSS will smooth this out.
        wrapper.style.transform = finalPosition;
        
        // Keep the blur for a moment during the "landing" for effect
        setTimeout(() => {
            reel.classList.remove('blur');
        }, 500);
    },

    async calculateWin(outcome) {
        let totalMultiplier = 0;
        const middleRow = outcome.map(reel => reel[1]);

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
