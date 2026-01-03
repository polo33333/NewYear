
// Countdown Timer Logic
let countdownInterval = null;

function updateCountdownDisplay(remainingMs) {
    const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

    document.getElementById('days').textContent = String(days).padStart(2, '0');
    document.getElementById('hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
}

async function checkCountdown() {
    try {
        const res = await fetch('/api/countdown');
        const data = await res.json();

        const countdownOverlay = document.getElementById('countdown-overlay');
        
        if (data.isActive && data.remainingMs > 0) {
            countdownOverlay.classList.remove('hidden');
            updateCountdownDisplay(data.remainingMs);

            if (countdownInterval) clearInterval(countdownInterval);
            
            countdownInterval = setInterval(async () => {
                const checkRes = await fetch('/api/countdown');
                const checkData = await checkRes.json();
                
                if (checkData.remainingMs <= 0) {
                    clearInterval(countdownInterval);
                    countdownOverlay.classList.add('hidden');
                    initializeGame();
                } else {
                    updateCountdownDisplay(checkData.remainingMs);
                }
            }, 1000);
        } else {
            countdownOverlay.classList.add('hidden');
            initializeGame();
        }
    } catch (err) {
        console.error('Error checking countdown:', err);
        initializeGame();
    }
}

function initializeGame() {
    initEnvelopes();
    updateStatus();
    checkAndShowWelcome();
}
