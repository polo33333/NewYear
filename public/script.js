// ============================================
// Dynamic Viewport Height Fix for Mobile
// ============================================
function setDynamicVH() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}
setDynamicVH();
window.addEventListener('resize', setDynamicVH);
window.addEventListener('orientationchange', () => setTimeout(setDynamicVH, 100));

// ============================================
// Main App Variables
// ============================================
const shakeBtn = document.getElementById('shake-btn');
const tree = document.getElementById('lucky-tree');
const treeContainer = document.getElementById('tree-container');
const attemptsCount = document.getElementById('attempts-count');
const rewardModal = document.getElementById('reward-modal');
const modalRewardValue = document.getElementById('modal-reward-value');
const closeModal = document.querySelector('.close-modal');
const dashboard = document.getElementById('dashboard');
const historyList = document.getElementById('history-list');
const bestRewardValue = document.getElementById('best-reward-value');

// ============================================
// Envelope Positions
// ============================================
const envelopePositions = [
    { top: '30%', left: '25%' }, { top: '35%', left: '45%' },
    { top: '28%', left: '65%' }, { top: '45%', left: '20%' },
    { top: '50%', left: '35%' }, { top: '48%', left: '60%' },
    { top: '55%', left: '75%' }, { top: '40%', left: '80%' },
    { top: '60%', left: '25%' }, { top: '65%', left: '50%' }
];

// ============================================
// Init Envelopes
// ============================================
function initEnvelopes() {
    document.querySelectorAll('.envelope').forEach(e => e.remove());

    envelopePositions.forEach((pos, index) => {
        const img = document.createElement('img');
        img.src = 'images/envelope.png';
        img.className = 'envelope';
        img.style.top = pos.top;
        img.style.left = pos.left;
        img.style.transform = `rotate(${Math.random() * 10 - 5}deg)`;
        img.style.animation = `sway-envelope ${2.5 + Math.random() * 2}s ease-in-out infinite`;
        img.id = `env-${index}`;
        treeContainer.appendChild(img);
        addTouchShakeEffect(img);
    });
}

// ============================================
// Greeting
// ============================================
const tetGreetings = [
    "🎊 Chúc Mừng Năm Mới - An Khang Thịnh Vượng!",
    "🌸 Vạn Sự Như Ý - Phát Tài Phát Lộc!",
    "🎉 Sức Khỏe Dồi Dào - Tài Lộc Đầy Nhà!"
];
let greetingTimeout = null;

function showRandomGreeting() {
    const display = document.getElementById('greeting-display');
    const text = document.getElementById('greeting-text');
    text.textContent = tetGreetings[Math.floor(Math.random() * tetGreetings.length)];
    display.classList.remove('hidden');
    clearTimeout(greetingTimeout);
    greetingTimeout = setTimeout(() => display.classList.add('hidden'), 8000);
}

function addTouchShakeEffect(env) {
    env.addEventListener('touchstart', e => {
        e.preventDefault();
        env.classList.add('envelope-touched');
        showRandomGreeting();
        setTimeout(() => env.classList.remove('envelope-touched'), 600);
    });
}

// ============================================
// Status API
// ============================================
async function updateStatus(auto = true) {
    const res = await fetch('/api/status');
    const data = await res.json();
    attemptsCount.innerText = data.maxAttempts - data.attempts;
    if (attemptsCount.innerText <= 0 && auto) showDashboard(data.rewards, data.bestReward);
}

// ============================================
// Shake Action
// ============================================
shakeBtn.addEventListener('click', async () => {
    shakeBtn.disabled = true;
    tree.classList.add('shaking-tree');

    setTimeout(async () => {
        const res = await fetch('/api/shake', { method: 'POST' });
        const data = await res.json();
        tree.classList.remove('shaking-tree');

        modalRewardValue.innerText = data.reward.name;
        rewardModal.classList.remove('hidden');
        updateStatus(false);
    }, 2000);
});

// ============================================
// Modal Close
// ============================================
closeModal.addEventListener('click', () => {
    rewardModal.classList.add('hidden');
    if (parseInt(attemptsCount.innerText) > 0) shakeBtn.disabled = false;
});

// ============================================
// SAFARI iOS SAFE AUDIO
// ============================================
const musicBtn = document.getElementById('music-btn');
const bgm = document.getElementById('bgm');

let isPlaying = false;
let audioUnlocked = false;
let isProcessing = false;

// 🔓 Unlock audio once
function unlockAudioOnce() {
    if (audioUnlocked) return;
    bgm.play().then(() => {
        bgm.pause();
        bgm.currentTime = 0;
        audioUnlocked = true;
        console.log("🔓 Audio unlocked");
    }).catch(() => { });
}

document.addEventListener('touchstart', unlockAudioOnce, { once: true });

// 🎵 Toggle music
musicBtn.addEventListener('touchstart', e => {
    e.preventDefault();
    e.stopPropagation();
    if (!audioUnlocked) return unlockAudioOnce();
    if (isProcessing) return;

    if (isPlaying) {
        bgm.pause();
        isPlaying = false;
        musicBtn.innerText = '🔇';
        return;
    }

    isProcessing = true;
    bgm.play().then(() => {
        isPlaying = true;
        musicBtn.innerText = '🔊';
    }).finally(() => isProcessing = false);
});

// ============================================
// Welcome Modal
// ============================================
const welcomeModal = document.getElementById('welcome-modal');
const startBtn = document.getElementById('start-btn');

startBtn.addEventListener('touchstart', () => {
    welcomeModal.classList.add('hidden');
    if (audioUnlocked && !isPlaying) {
        bgm.play().then(() => {
            isPlaying = true;
            musicBtn.innerText = '🔊';
        });
    }
});

// ============================================
// Preload (NO AUDIO HERE ❌)
// ============================================
function preloadAssets() {
    const loadingScreen = document.getElementById('loading-screen');
    const progressBar = document.getElementById('progress-bar');
    const loadingText = document.getElementById('loading-text');

    const assets = [
        'images/background.png',
        'images/envelope.png',
        'images/tree.png',
        'images/tree_no_env.png'
    ];

    let loaded = 0;
    const total = assets.length;

    const updateProgress = () => {
        loaded++;
        const percent = Math.round((loaded / total) * 100);
        progressBar.style.width = percent + '%';
        loadingText.textContent = `Đang tải... ${percent}%`;
    };

    return Promise.all(assets.map(src => new Promise(res => {
        const img = new Image();
        img.onload = () => {
            updateProgress();
            res();
        };
        img.onerror = () => {
            updateProgress();
            res();
        };
        img.src = src;
    })));
}

// ============================================
// Init
// ============================================
preloadAssets().then(() => {
    const loadingScreen = document.getElementById('loading-screen');

    // Hide loading screen
    setTimeout(() => {
        loadingScreen.classList.add('loaded');
        setTimeout(() => loadingScreen.remove(), 500);
    }, 300);

    // Initialize game
    initEnvelopes();
    updateStatus();
});
