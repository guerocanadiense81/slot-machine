/**
 * @file wallet.js
 * @description Manages all wallet interactions, balance updates, and API communication.
 * Handles both free-to-play (simulated) and paid (Web3) modes.
 */
const Wallet = {
    state: {
        isFreeMode: true,
        credits: 1000,
        onChainBalance: 0,
        walletAddress: null,
        provider: null,
        signer: null,
    },
    dom: {},
    MET_CONTRACT_ADDRESS: "0xb80b92Be7402E1e2D3189fff261D672D8104b322",
    MET_ABI: ["function balanceOf(address owner) view returns (uint256)"],

    init() {
        this.cacheDOMElements();
        this.state.isFreeMode = !this.dom.connectWalletBtn;

        if (this.state.isFreeMode) {
            console.log("Wallet: Initializing in Free Mode.");
            this.updateUIDisplay();
        } else {
            console.log("Wallet: Initializing in Paid Mode.");
            this.attachEventListeners();
            if (typeof ethers === "undefined") {
                console.error("Ethers.js is not loaded! Paid mode will not work.");
                return;
            }
            this.state.provider = new ethers.providers.Web3Provider(window.ethereum);
        }
    },

    cacheDOMElements() {
        this.dom = {
            connectWalletBtn: document.getElementById('connectWallet'),
            creditsDisplay: document.getElementById('credits-display'),
            onChainBalanceDisplay: document.getElementById('metOnChainBalance'),
            depositInput: document.getElementById('depositInput'),
            depositButton: document.querySelector('#depositSection button'),
            cashOutButton: document.querySelector('#cashOutSection button')
        };
    },

    attachEventListeners() {
        if (this.dom.connectWalletBtn) this.dom.connectWalletBtn.addEventListener('click', () => this.connect());
        if (this.dom.depositButton) this.dom.depositButton.addEventListener('click', () => this.deposit());
        if (this.dom.cashOutButton) this.dom.cashOutButton.addEventListener('click', () => this.reconcile());
    },

    async connect() {
        if (!window.ethereum) return alert("Please install MetaMask.");
        try {
            const accounts = await this.state.provider.send("eth_requestAccounts", []);
            this.state.walletAddress = accounts[0];
            this.state.signer = this.state.provider.getSigner();
            this.dom.connectWalletBtn.textContent = `Connected: ${this.state.walletAddress.substring(0, 6)}...`;
            await this.fetchOffChainBalance();
            await this.fetchOnChainBalance();
        } catch (error) {
            console.error("Failed to connect wallet:", error);
        }
    },

    async fetchOffChainBalance() {
        if (!this.state.walletAddress) return;
        const res = await fetch(`/api/user/${this.state.walletAddress.toLowerCase()}`);
        const data = await res.json();
        this.state.credits = parseFloat(data.total);
        this.updateUIDisplay();
    },

    async fetchOnChainBalance() {
        if (!this.state.signer) return;
        const contract = new ethers.Contract(this.MET_CONTRACT_ADDRESS, this.MET_ABI, this.state.provider);
        const balanceBN = await contract.balanceOf(this.state.walletAddress);
        this.state.onChainBalance = ethers.utils.formatUnits(balanceBN, 18);
        this.updateUIDisplay();
    },

    checkBalance(amount) {
        return this.state.credits >= amount;
    },

    async updateBalance(delta) {
        this.state.credits += delta;
        if (!this.state.isFreeMode && this.state.walletAddress) {
            try {
                await fetch(`/api/balance-change/${this.state.walletAddress.toLowerCase()}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ delta })
                });
            } catch (error) {
                this.state.credits -= delta; // Revert on failure
            }
        }
        this.updateUIDisplay();
    },
    
    updateUIDisplay() {
        if (this.dom.creditsDisplay) this.dom.creditsDisplay.textContent = this.state.credits.toFixed(2);
        if (this.dom.onChainBalanceDisplay) this.dom.onChainBalanceDisplay.textContent = parseFloat(this.state.onChainBalance).toFixed(2);
    }
};

window.Wallet = Wallet;
