// ============================================
// Dynamic Viewport Height Fix for Mobile
// ============================================
// Fix for mobile browsers where 100vh doesn't account for address bar
function setDynamicVH() {
    // Calculate actual viewport height
    const vh = window.innerHeight * 0.01;
    // Set CSS custom property
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// Set on load
setDynamicVH();

// Update on resize and orientation change
window.addEventListener('resize', setDynamicVH);
window.addEventListener('orientationchange', () => {
    // Small delay to ensure browser has updated dimensions
    setTimeout(setDynamicVH, 100);
});

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

// Envelope Positions (Percentage relative to container 600x600)
const envelopePositions = [
    { top: '30%', left: '25%' },
    { top: '35%', left: '45%' },
    { top: '28%', left: '65%' },
    { top: '45%', left: '20%' },
    { top: '50%', left: '35%' },
    { top: '48%', left: '60%' },
    { top: '55%', left: '75%' },
    { top: '40%', left: '80%' },
    { top: '60%', left: '25%' },
    { top: '65%', left: '50%' }
];

// Initialize Envelopes
function initEnvelopes() {
    // Clear existing (except tree)
    const existing = document.querySelectorAll('.envelope');
    existing.forEach(e => e.remove());

    envelopePositions.forEach((pos, index) => {
        const img = document.createElement('img');
        img.src = 'images/envelope.png';
        img.classList.add('envelope');
        img.style.top = pos.top;
        img.style.left = pos.left;

        // Randomize initial slight rotation for natural look
        const randomRot = Math.random() * 10 - 5;

        // Initial state is swaying (wind effect) with varied durations
        const duration = 2.5 + Math.random() * 2; // 2.5-4.5s duration for variety
        const delay = Math.random() * 2;

        img.style.transform = `rotate(${randomRot}deg)`;
        img.style.animation = `sway-envelope ${duration}s ease-in-out infinite`;
        img.style.animationDelay = `-${delay}s`; // Negative delay to start at random positions

        img.id = `env-${index}`;
        treeContainer.appendChild(img);

        // Randomly add wind gust effect to some envelopes
        if (Math.random() > 0.5) {
            addRandomWindGusts(img);
        }

        // Add touch/click shake effect
        addTouchShakeEffect(img);
    });
}

// Tet Greeting Messages
const tetGreetings = [
    "🎊 Chúc Mừng Năm Mới - An Khang Thịnh Vượng! 🎊",
    "🌸 Vạn Sự Như Ý - Phát Tài Phát Lộc! 🌸",
    "🎉 Sức Khỏe Dồi Dào - Tài Lộc Đầy Nhà! 🎉",
    "🏮 Xuân Về Muôn Phước - Lộc Đến Nghìn Vàng! 🏮",
    "🎆 Năm Mới Bình An - Hạnh Phúc Tràn Đầy! 🎆",
    "🌺 Tiền Vào Như Nước - Của Đến Như Mây! 🌺",
    "✨ Phúc Lộc Thọ - Tài Danh Vượng! ✨",
    "🎁 Cát Tường Như Ý - Vạn Sự Hanh Thông! 🎁",
    "🌟 Tấn Tài Tấn Lộc - Phát Đạt Vượng Khí! 🌟",
    "🎋 Xuân Sang Phúc Đến - Lộc Tới Tài Về! 🎋",
    "💰 Tiền Tài Đầy Túi - Vàng Bạc Đầy Nhà! 💰",
    "🌼 Năm Mới Sung Túc - Vui Vẻ Hạnh Phúc! 🌼",
    "🎇 Đại Cát Đại Lợi - Vạn Sự Như Ý! 🎇",
    "🧧 Lộc Phát Tài Sinh - Phúc Đức Dồi Dào! 🧧",
    "🎊 Xuân Về Đất Ấm - Lộc Đến Nhà Giàu! 🎊"
];

let greetingTimeout = null;

// Add touch/click shake effect to envelope
function addTouchShakeEffect(envelope) {
    const handleTouch = (e) => {
        e.preventDefault(); // Prevent default touch behavior

        // Save current animation
        const currentAnimation = envelope.style.animation;

        // Add touched class to trigger shake
        envelope.classList.add('envelope-touched');

        // Show random Tet greeting
        showRandomGreeting();

        // Remove class and restore animation after shake completes
        setTimeout(() => {
            envelope.classList.remove('envelope-touched');
            envelope.style.animation = currentAnimation;
        }, 600); // Match animation duration
    };

    // Add both click and touch events for desktop and mobile
    envelope.addEventListener('click', handleTouch);
    envelope.addEventListener('touchstart', handleTouch);

    // Add cursor pointer for desktop
    envelope.style.cursor = 'pointer';
}

// Show random Tet greeting at bottom
function showRandomGreeting() {
    const greetingDisplay = document.getElementById('greeting-display');
    const greetingText = document.getElementById('greeting-text');

    // Pick random greeting
    const randomGreeting = tetGreetings[Math.floor(Math.random() * tetGreetings.length)];

    // Update text and show
    greetingText.textContent = randomGreeting;
    greetingDisplay.classList.remove('hidden');

    // Clear existing timeout
    if (greetingTimeout) {
        clearTimeout(greetingTimeout);
    }

    // Auto-hide after 8 seconds (match marquee animation duration)
    greetingTimeout = setTimeout(() => {
        greetingDisplay.classList.add('hidden');
    }, 8000);
}

// Add random wind gust effects
function addRandomWindGusts(envelope) {
    const triggerGust = () => {
        const currentAnimation = envelope.style.animation;

        // Temporarily switch to wind gust animation
        envelope.style.animation = 'wind-gust-envelope 2s ease-in-out';

        // Return to normal swaying after gust
        setTimeout(() => {
            envelope.style.animation = currentAnimation;
        }, 2000);

        // Schedule next random gust (between 8-15 seconds)
        const nextGust = 8000 + Math.random() * 7000;
        setTimeout(triggerGust, nextGust);
    };

    // Start first gust after random delay (3-10 seconds)
    const initialDelay = 3000 + Math.random() * 7000;
    setTimeout(triggerGust, initialDelay);
}

// Fetch initial status
async function updateStatus(autoShowDashboard = true) {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();

        const remaining = data.maxAttempts - data.attempts;
        attemptsCount.innerText = remaining;

        if (remaining <= 0 && autoShowDashboard) {
            showDashboard(data.rewards, data.bestReward);
        }
        return data;
    } catch (err) {
        console.error("Error fetching status:", err);
    }
}

// Fireworks Effect
let fireworksInterval = null;

function createFireworks() {
    const container = document.createElement('div');
    container.className = 'fireworks-container';
    container.id = 'fireworks-display';
    document.body.appendChild(container);

    const colors = [
        '#ff0000', '#ffd700', '#ff69b4', '#00ff00', '#00bfff',
        '#ff4500', '#9370db', '#ff1493', '#00ff7f', '#ffff00',
        '#ff00ff', '#00ffff', '#ff6347', '#7fff00', '#ff8c00'
    ];

    // Create continuous infinite firework bursts with multiple simultaneous explosions
    fireworksInterval = setInterval(() => {
        // Create 2-3 fireworks simultaneously for more spectacular effect
        const burstCount = Math.floor(Math.random() * 2) + 2; // 2-3 bursts

        for (let i = 0; i < burstCount; i++) {
            setTimeout(() => {
                const x = Math.random() * window.innerWidth;
                const y = Math.random() * (window.innerHeight * 0.6) + 50;
                const color = colors[Math.floor(Math.random() * colors.length)];
                const size = Math.random() > 0.7 ? 'large' : 'normal'; // 30% chance of large burst
                createFireworkBurst(container, x, y, color, size);
            }, i * 100);
        }
    }, 400);
}

function stopFireworks() {
    if (fireworksInterval) {
        clearInterval(fireworksInterval);
        fireworksInterval = null;
    }
    const container = document.getElementById('fireworks-display');
    if (container) {
        container.remove();
    }
}

function createFireworkBurst(container, x, y, color, size = 'normal') {
    const particleCount = size === 'large' ? 50 : 35; // More particles
    const particleSize = size === 'large' ? 6 : 4;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'firework';
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.background = color;
        particle.style.width = particleSize + 'px';
        particle.style.height = particleSize + 'px';
        particle.style.boxShadow = `0 0 ${particleSize * 2}px ${color}`; // Glow effect

        const angle = (Math.PI * 2 * i) / particleCount;
        const velocity = size === 'large' ? 80 + Math.random() * 120 : 60 + Math.random() * 100;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;

        particle.style.setProperty('--tx', tx + 'px');
        particle.style.setProperty('--ty', ty + 'px');

        container.appendChild(particle);

        setTimeout(() => particle.remove(), 2000); // Longer duration
    }
}

function showDashboard(rewards, best) {
    shakeBtn.disabled = true;
    shakeBtn.innerText = "Hết Lượt";

    // Populate History
    historyList.innerHTML = '';
    rewards.forEach((r, idx) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `<span>Lần ${idx + 1}</span> <span>${r.name}</span>`;
        historyList.appendChild(div);
    });

    // Best Reward
    const claimBtn = document.getElementById('claim-btn');
    if (best) {
        bestRewardValue.innerText = best.name;

        // Handle Claim Button
        claimBtn.onclick = async () => {
            try {
                const res = await fetch('/api/claim', { method: 'POST' });
                const data = await res.json();

                if (res.ok) {
                    // Check for link in the best reward object
                    // We use 'best' passed from server which comes from rewards history
                    if (best.linkReward && best.linkReward.trim() !== "") {
                        window.open(best.linkReward, '_blank');
                    } else {
                        alert("Chúc mừng! Bạn đã nhận: " + data.reward.name);
                    }
                    // Optionally disable button after claim or show "Claimed"
                    claimBtn.innerText = "Đã Nhận";
                    claimBtn.disabled = true;
                } else {
                    alert(data.message);
                }
            } catch (err) {
                console.error("Error claiming:", err);
            }
        };
    }

    // Create dark overlay
    const overlay = document.createElement('div');
    overlay.className = 'dashboard-overlay';
    overlay.id = 'dashboard-overlay';
    document.body.appendChild(overlay);

    // Trigger fireworks celebration
    createFireworks();

    dashboard.classList.remove('hidden');
    dashboard.classList.add('show-with-fireworks');
}

// Shake Action
shakeBtn.addEventListener('click', async () => {
    shakeBtn.disabled = true;

    // 1. Shake the Tree
    tree.classList.add('shaking-tree');

    // 2. Swing the Envelopes individually with random delays
    const envelopes = Array.from(document.querySelectorAll('.envelope'));
    // Filter out already fallen ones just in case script doesn't remove them (though we will)
    const activeEnvelopes = envelopes.filter(e => e.style.display !== 'none');

    activeEnvelopes.forEach(env => {
        env.style.animation = 'none';
        env.offsetHeight; /* trigger reflow */

        const duration = 1 + Math.random();
        const delay = Math.random() * 0.2;

        env.style.animation = `swing-envelope ${duration}s ease-in-out infinite`;
        env.style.animationDelay = `${delay}s`;
    });

    // Wait for animation (e.g., 2s) and API call
    setTimeout(async () => {
        try {
            const res = await fetch('/api/shake', { method: 'POST' });
            const data = await res.json();

            tree.classList.remove('shaking-tree');

            // Stop swinging
            activeEnvelopes.forEach(env => {
                env.style.animation = 'none';
                // Set a random rotation so they don't look all identical
                env.style.transform = `rotate(${Math.random() * 6 - 3}deg)`;
            });

            if (res.ok) {
                // 3. Pick one random envelope to fall
                if (activeEnvelopes.length > 0) {
                    const randomIndex = Math.floor(Math.random() * activeEnvelopes.length);
                    const chosenEnv = activeEnvelopes[randomIndex];

                    // CLEAR inline animation
                    chosenEnv.style.animation = '';

                    // Stage 1: Fall down
                    chosenEnv.classList.add('falling');

                    // Wait for fall to finish (0.8s) then trigger Stage 2 (Fly Up)
                    setTimeout(() => {
                        // Hide original envelope
                        chosenEnv.style.display = 'none';

                        // Stage 2: Create a temporary envelope that flies up from bottom
                        const flyingEnv = document.createElement('img');
                        flyingEnv.src = 'images/envelope.png';
                        flyingEnv.classList.add('center-envelope');
                        document.body.appendChild(flyingEnv);

                        // Wait for fly up to finish (1.2s) before showing modal
                        setTimeout(() => {
                            flyingEnv.remove(); // Remove flying envelope

                            modalRewardValue.innerText = data.reward.name;
                            rewardModal.classList.remove('hidden');
                            updateStatus(false); // Don't auto-show dashboard

                        }, 1200);

                    }, 800);
                } else {
                    // Fallback
                    modalRewardValue.innerText = data.reward.name;
                    rewardModal.classList.remove('hidden');
                    updateStatus(false); // Don't auto-show dashboard
                }

            } else {
                alert(data.message);
                updateStatus(false); // Don't auto-show dashboard
            }
        } catch (err) {
            console.error("Error during shake:", err);
            tree.classList.remove('shaking-tree');
            shakeBtn.disabled = false;
        }
    }, 2000);
});

// Close Modal
closeModal.addEventListener('click', async () => {
    rewardModal.classList.add('hidden');
    const remaining = parseInt(attemptsCount.innerText);
    if (remaining > 0) {
        shakeBtn.disabled = false;
    } else {
        // If no attempts left, show dashboard after a short delay
        setTimeout(async () => {
            const data = await fetch('/api/status').then(res => res.json());
            showDashboard(data.rewards, data.bestReward);
        }, 500);
    }
});

// Music Control
const musicBtn = document.getElementById('music-btn');
const bgm = document.getElementById('bgm');
let isPlaying = true; // Default to true since we added autoplay

// Attempt to play on load (may be blocked by browser)
window.addEventListener('load', () => {
    alert('[DEBUG] Window loaded, attempting autoplay...');
    bgm.play().then(() => {
        alert('[DEBUG] ✅ Autoplay SUCCESS on load!');
        musicBtn.innerText = '🔊';
        musicBtn.title = "Tắt Nhạc";
        isPlaying = true;
    }).catch(err => {
        alert('[DEBUG] ❌ Autoplay BLOCKED on load: ' + err.message);
        console.log("Autoplay blocked, waiting for interaction");
        musicBtn.innerText = '🔇';
        musicBtn.title = "Bật Nhạc";
        isPlaying = false;
    });
});

// Fallback: Start music on FIRST interaction (click/touch) if it's not playing
function startMusicOnInteraction() {
    if (!isPlaying) {
        // alert('[DEBUG] Fallback interaction detected, playing music...');
        bgm.play().then(() => {
            // alert('[DEBUG] ✅ Fallback music play SUCCESS!');
            musicBtn.innerText = '🔊';
            musicBtn.title = "Tắt Nhạc";
            isPlaying = true;
            // Remove listener once successful
            document.removeEventListener('click', startMusicOnInteraction);
            document.removeEventListener('touchstart', startMusicOnInteraction);
        }).catch(err => {
            // alert('[DEBUG] ❌ Fallback music play FAILED: ' + err.message);
            console.log("Still blocked or failed");
        });
    }
}

document.addEventListener('click', startMusicOnInteraction);
document.addEventListener('touchstart', startMusicOnInteraction);

musicBtn.addEventListener('click', (e) => {
    // Prevent the global listener from firing double logic if clicking the button itself
    e.stopPropagation();

    if (isPlaying) {
        alert('[DEBUG] Music button clicked - PAUSING music');
        bgm.pause();
        musicBtn.innerText = '🔇';
        musicBtn.title = "Bật Nhạc";
    } else {
        alert('[DEBUG] Music button clicked - PLAYING music...');
        bgm.play().then(() => {
            alert('[DEBUG] ✅ Manual play SUCCESS!');
            musicBtn.innerText = '🔊';
            musicBtn.title = "Tắt Nhạc";
        }).catch(err => {
            alert('[DEBUG] ❌ Manual play FAILED: ' + err.message);
            console.error("Audio play failed:", err);
        });
    }
    isPlaying = !isPlaying;

    // If user manually toggles, we can remove the global auto-start listeners as they have made a choice
    document.removeEventListener('click', startMusicOnInteraction);
    document.removeEventListener('touchstart', startMusicOnInteraction);
});

// Welcome Modal for New Users
const welcomeModal = document.getElementById('welcome-modal');
const startBtn = document.getElementById('start-btn');

// Show welcome modal if user is new (has 3 attempts)
async function checkAndShowWelcome() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();

        // Show welcome if user has all 3 attempts (new user)
        if (data.attempts === 0 && data.maxAttempts === 3) {
            welcomeModal.classList.remove('hidden');
        }
    } catch (err) {
        console.error("Error checking welcome status:", err);
    }
}

// Close welcome modal and start game
startBtn.addEventListener('click', () => {
    welcomeModal.classList.add('hidden');

    // Auto-play music when user clicks "Start" button
    if (!isPlaying) {
        //alert('[DEBUG] Welcome modal - "Bắt Đầu Ngay" clicked, isPlaying=' + isPlaying + ', attempting to play...');
        bgm.play().then(() => {
            //alert('[DEBUG] ✅ Welcome modal music play SUCCESS!');
            musicBtn.innerText = '🔊';
            musicBtn.title = "Tắt Nhạc";
            isPlaying = true;
            console.log("Music started from welcome modal");

            // Remove global auto-start listeners since user has interacted
            document.removeEventListener('click', startMusicOnInteraction);
            document.removeEventListener('touchstart', startMusicOnInteraction);
        }).catch(err => {
            //alert('[DEBUG] ❌ Welcome modal music play FAILED: ' + err.message);
            console.log("Music autoplay failed from welcome modal:", err);
            // If it fails, the global listeners will still work
        });
    } else {
        //alert('[DEBUG] Welcome modal - Music already playing (isPlaying=' + isPlaying + ')');
    }
});

// Asset Preloader
function preloadAssets() {
    return new Promise((resolve) => {
        const loadingScreen = document.getElementById('loading-screen');
        const progressBar = document.getElementById('progress-bar');
        const loadingText = document.getElementById('loading-text');

        // List all assets to preload
        const assets = [
            'images/background.png',
            'images/envelope.png',
            'images/tree.png',
            'images/tree_no_env.png',
            'audio/bgm.mp3'
        ];

        let loadedCount = 0;
        const totalAssets = assets.length;

        function updateProgress() {
            loadedCount++;
            const progress = Math.round((loadedCount / totalAssets) * 100);
            progressBar.style.width = progress + '%';
            loadingText.textContent = `Đang tải... ${progress}%`;

            if (loadedCount === totalAssets) {
                // All assets loaded
                setTimeout(() => {
                    loadingScreen.classList.add('loaded');
                    resolve();
                }, 500); // Small delay to show 100%
            }
        }

        // Preload images
        assets.forEach(assetPath => {
            if (assetPath.endsWith('.mp3')) {
                // Preload audio
                const audio = new Audio();
                audio.addEventListener('canplaythrough', updateProgress, { once: true });
                audio.addEventListener('error', () => {
                    console.warn(`Failed to load audio: ${assetPath}`);
                    updateProgress(); // Continue even if one asset fails
                });
                audio.src = assetPath;
                audio.load();
            } else {
                // Preload image
                const img = new Image();
                img.onload = updateProgress;
                img.onerror = () => {
                    console.warn(`Failed to load image: ${assetPath}`);
                    updateProgress(); // Continue even if one asset fails
                };
                img.src = assetPath;
            }
        });
    });
}

// Initialize app after preloading
preloadAssets().then(() => {
    // Remove loading screen from DOM after fade out
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.remove();
        }
    }, 500);

    // Check countdown and initialize
    checkCountdown();
});

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
