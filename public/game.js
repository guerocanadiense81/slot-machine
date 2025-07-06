/**
 * @file game.js
 * @description Final, complete version with realistic spin and updated win rules.
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
            threeInRow: 1.5,
            twoInRow: 0.5 // Payout for 2-of-a-kind
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

            setTimeout(() => {
                reel.classList.add('spinning', 'blur');
            }, i * 150);
        }

        for (let i = 0; i < CONFIG.NUM_REELS; i++) {
            setTimeout(() => {
                this.stopReel(this.dom.reelColumns[i]);
            }, 2000 + (i * 500));
        }

        setTimeout(() => {
            gameState.isSpinning = false;
            this.dom.spinButton.disabled = false;
            this.calculateWin(outcome);
        }, 2000 + (CONFIG.NUM_REELS * 500));
    },
    
    prepareReelForSpin(reel, finalSymbols) {
        const wrapper = reel.querySelector('.icons-wrapper');
        
        wrapper.style.transition = 'none';
        wrapper.style.transform = 'translateY(0)';
        
        const icons = wrapper.querySelectorAll('.icon');
        for (let j = 0; j < 3; j++) {
            const iconImg = icons[icons.length - 3 + j].querySelector('img');
            iconImg.src = `items/${finalSymbols[j]}.png`;
            iconImg.alt = finalSymbols[j];
        }
    },

    stopReel(reel) {
        const wrapper = reel.querySelector('.icons-wrapper');
        const finalPosition = `translateY(calc(-100% + 300px))`;
        
        reel.classList.remove('spinning');
        wrapper.style.transform = finalPosition;
        
        setTimeout(() => {
            reel.classList.remove('blur');
        }, 500);
    },

    async calculateWin(outcome) {
        let totalMultiplier = 0;
        const multipliers = CONFIG.WIN_CONFIG.multipliers;

        // Define all 5 potential win lines
        const winLines = [
            outcome.map(reel => reel[0]), // Top row
            outcome.map(reel => reel[1]), // Middle row
            outcome.map(reel => reel[2]), // Bottom row
            [outcome[0][0], outcome[1][1], outcome[2][2], outcome[3][1], outcome[4][0]], // V-shape line
            [outcome[0][2], outcome[1][1], outcome[2][0], outcome[3][1], outcome[4][2]]  // Inverted V-shape
        ];

        for (const line of winLines) {
            // Check for 5-in-a-row
            if (line.every(s => s === line[0])) {
                totalMultiplier += (line[0] === 'big_win') ? multipliers.fiveInRowBigWin : multipliers.fiveInRow;
                continue; 
            }
            
            // Check for 4-in-a-row (from left)
            if (line[0] === line[1] && line[0] === line[2] && line[0] === line[3]) {
                totalMultiplier += multipliers.threeInRow * 1.5; // Custom multiplier for 4-in-a-row
            }
            // Check for 3-in-a-row (from left)
            else if (line[0] === line[1] && line[0] === line[2]) {
                totalMultiplier += multipliers.threeInRow;
            }
            // Check for 2-in-a-row (from left)
            else if (line[0] === line[1]) {
                totalMultiplier += multipliers.twoInRow;
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
