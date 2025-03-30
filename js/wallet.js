const API_URL = 'https://slot-machine-a08c.onrender.com';

let web3;
let walletAddress;
let tokenContract;

const tokenAddress = "0xb80b92Be7402E1e2D3189fff261D672D8104b322";
const tokenABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function"
  }
];

async function initWeb3() {
  if (typeof window.ethereum !== "undefined") {
    web3 = new Web3(window.ethereum);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      walletAddress = accounts[0];
      tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
      document.getElementById("walletAddress").innerText = `Wallet: ${walletAddress}`;
      await fetchMETBalance();
    } catch (err) {
      console.error("Wallet connection failed", err);
    }
  } else {
    alert("Please install MetaMask!");
  }
}

async function fetchMETBalance() {
  if (!walletAddress || !tokenContract) return;
  try {
    const balanceWei = await tokenContract.methods.balanceOf(walletAddress).call();
    const balance = parseFloat(web3.utils.fromWei(balanceWei, "ether"));
    document.getElementById("metBalance").innerText = `${balance.toFixed(2)} MET`;
  } catch (err) {
    console.error("Failed to fetch MET balance:", err);
  }
}

window.addEventListener("load", () => {
  const connectBtn = document.getElementById("connectWallet");
  if (connectBtn) {
    connectBtn.addEventListener("click", initWeb3);
  }
});
