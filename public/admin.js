document.addEventListener("DOMContentLoaded", async () => {
    const winInput = document.getElementById("winPercentageInput");
    const res = await fetch("/api/get-win-percentage");
    const data = await res.json();
    winInput.value = data.percentage;

    const logDiv = document.getElementById("transactionLog");
    fetch("/api/transactions")
        .then(response => response.json())
        .then(data => {
            logDiv.innerHTML = data.transactions.map(tx => `
                <div>
                    <strong>${tx.address}</strong> - ${tx.amount} MET - ${tx.status} - ${new Date(tx.date).toLocaleString()}
                </div>
            `).join('');
        });
});

async function updateWinPercentage() {
    const percentage = parseInt(document.getElementById("winPercentageInput").value);
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        alert("Please enter a valid percentage between 0 and 100");
        return;
    }
    const res = await fetch("/api/set-win-percentage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ percentage })
    });
    const data = await res.json();
    if (data.success) {
        alert("Win percentage updated!");
    }
}

function downloadCSV() {
    window.location.href = "/api/download-transactions";
}
