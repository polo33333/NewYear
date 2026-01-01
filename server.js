const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4100;

// Admin credentials (in production, use environment variables and hashed passwords)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '12345678.c';

app.use(cors());
app.use(bodyParser.json());

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: false // Set to true in production with HTTPS
    }
}));

// Middleware to block direct access to admin.html
app.use((req, res, next) => {
    // Block direct access to admin.html (must go through /admin route)
    if (req.path === '/admin.html') {
        return res.status(403).send('Forbidden - Access admin panel via /admin');
    }
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public'), {
    index: false
}));

const DATA_DIR = path.join(__dirname, 'data');
const REWARDS_FILE = path.join(DATA_DIR, 'rewards.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Helper to read JSON
const readJson = (file) => {
    if (!fs.existsSync(file)) return [];
    try {
        const data = fs.readFileSync(file, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading file:", file, err);
        return [];
    }
};

// Helper to write JSON
const writeJson = (file, data) => {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error writing file:", file, err);
    }
};

// Probability Logic with Quantity Management
const pickReward = (rewards) => {
    // Filter out rewards with no remaining quantity
    const availableRewards = rewards.filter(r => r.remaining > 0);

    if (availableRewards.length === 0) {
        return null; // No rewards available
    }

    // Calculate total probability of available rewards
    const totalProb = availableRewards.reduce((sum, r) => sum + r.probability, 0);

    // Random selection based on normalized probabilities
    const random = Math.random() * totalProb;
    let currentProb = 0;

    for (const reward of availableRewards) {
        currentProb += reward.probability;
        if (random <= currentProb) {
            return reward;
        }
    }

    return availableRewards[0]; // Fallback
};

// Get User IP
const getUserIp = (req) => {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
};

// ============ ROUTES ============

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API: Get Status
app.get('/api/status', (req, res) => {
    const ip = getUserIp(req);
    const users = readJson(USERS_FILE);
    const user = users[ip] || { attempts: 0, rewards: [], claimed: false };

    // Calculate best reward so far
    let bestReward = null;
    if (user.rewards.length > 0) {
        bestReward = user.rewards.reduce((prev, current) => (prev.value > current.value) ? prev : current);
    }

    res.json({
        attempts: user.attempts,
        maxAttempts: 3,
        rewards: user.rewards,
        bestReward: bestReward,
        claimed: user.claimed
    });
});

// API: Shake
app.post('/api/shake', (req, res) => {
    const ip = getUserIp(req);
    let users = readJson(USERS_FILE);
    const rewards = readJson(REWARDS_FILE);

    if (!users[ip]) {
        users[ip] = { attempts: 0, rewards: [], claimed: false, firstSeen: Date.now() };
    }

    const user = users[ip];

    if (user.attempts >= 3) {
        return res.status(400).json({ message: "You have used all your attempts!" });
    }

    if (user.claimed) {
        return res.status(400).json({ message: "You have already claimed your reward." });
    }

    // Shake logic
    const reward = pickReward(rewards);

    // Check if any rewards are available
    if (!reward) {
        return res.status(400).json({
            message: "Hết phần thưởng! Vui lòng quay lại sau.",
            outOfStock: true
        });
    }

    // NOTE: Do NOT decrement quantity here!
    // Quantity will be decremented only when user claims the best reward

    user.attempts += 1;
    user.rewards.push({ ...reward, timestamp: Date.now() });

    users[ip] = user;
    writeJson(USERS_FILE, users);

    res.json({
        reward: reward,
        attempts: user.attempts,
        message: "Congratulations!"
    });
});

// API: Claim (Optional if we just want to auto-assign the best, but good for tracking)
app.post('/api/claim', (req, res) => {
    const ip = getUserIp(req);
    let users = readJson(USERS_FILE);
    let rewards = readJson(REWARDS_FILE);

    if (!users[ip]) {
        return res.status(404).json({ message: "User not found." });
    }

    const user = users[ip];

    if (user.rewards.length === 0) {
        return res.status(400).json({ message: "No rewards to claim." });
    }

    if (user.claimed) {
        return res.status(200).json({ message: "Already claimed." });
    }

    // Find best reward
    const bestReward = user.rewards.reduce((prev, current) => (prev.value > current.value) ? prev : current);

    // Decrement quantity of the best reward ONLY when claiming
    const rewardIndex = rewards.findIndex(r => r.id === bestReward.id);
    if (rewardIndex !== -1 && rewards[rewardIndex].remaining > 0) {
        rewards[rewardIndex].remaining -= 1;
        writeJson(REWARDS_FILE, rewards);
    } else if (rewardIndex !== -1 && rewards[rewardIndex].remaining === 0) {
        return res.status(400).json({
            message: "Phần thưởng này đã hết! Vui lòng liên hệ admin.",
            outOfStock: true
        });
    }

    user.claimed = true;
    user.finalReward = bestReward;

    users[ip] = user;
    writeJson(USERS_FILE, users);

    res.json({
        message: "Reward claimed successfully!",
        reward: bestReward
    });
});

// ============ AUTHENTICATION ============

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    res.status(401).json({ message: 'Unauthorized. Please login.' });
};

// Login endpoint
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        req.session.username = username;
        res.json({
            success: true,
            message: 'Login successful',
            username: username
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Invalid username or password'
        });
    }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Check auth status
app.get('/api/auth/status', (req, res) => {
    if (req.session && req.session.isAdmin) {
        res.json({
            authenticated: true,
            username: req.session.username
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Serve admin login page
app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// Serve admin dashboard (protected)
app.get('/admin', (req, res) => {
    if (req.session && req.session.isAdmin) {
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } else {
        res.redirect('/admin/login');
    }
});

// ============ ADMIN APIs ============

// Reset all reward quantities
app.post('/api/admin/rewards/reset', requireAuth, (req, res) => {
    let rewards = readJson(REWARDS_FILE);

    // Reset remaining to quantity for all rewards
    rewards = rewards.map(reward => ({
        ...reward,
        remaining: reward.quantity
    }));

    writeJson(REWARDS_FILE, rewards);

    res.json({
        success: true,
        message: "Đã reset tất cả số lượng phần thưởng",
        rewards
    });
});

// Get all users (protected)
app.get('/api/admin/users', requireAuth, (req, res) => {
    const users = readJson(USERS_FILE);

    // Convert object to array with IP as a property
    const userArray = Object.keys(users).map(ip => ({
        ip,
        ...users[ip]
    }));

    res.json(userArray);
});

// Get rewards configuration (protected)
app.get('/api/admin/rewards', requireAuth, (req, res) => {
    const rewards = readJson(REWARDS_FILE);
    res.json(rewards);
});

// Update rewards configuration (protected)
app.put('/api/admin/rewards', requireAuth, (req, res) => {
    const { rewards } = req.body;

    if (!Array.isArray(rewards)) {
        return res.status(400).json({ message: "Invalid rewards data" });
    }

    // Validate each reward
    for (const reward of rewards) {
        if (!reward.quantity || reward.quantity < 0) {
            return res.status(400).json({
                message: `Reward "${reward.name}" must have a valid quantity`
            });
        }
        if (!reward.hasOwnProperty('remaining') || reward.remaining < 0) {
            return res.status(400).json({
                message: `Reward "${reward.name}" must have a valid remaining value`
            });
        }
        if (reward.remaining > reward.quantity) {
            return res.status(400).json({
                message: `Reward "${reward.name}": remaining cannot exceed quantity`
            });
        }
    }

    // Validate probabilities sum
    const totalProb = rewards.reduce((sum, r) => sum + (r.probability || 0), 0);
    if (Math.abs(totalProb - 1.0) > 0.01) {
        return res.status(400).json({
            message: `Total probability must equal 1.0 (current: ${totalProb.toFixed(2)})`
        });
    }

    writeJson(REWARDS_FILE, rewards);
    res.json({ message: "Rewards updated successfully", rewards });
});

// Delete a user by IP (protected)
app.delete('/api/admin/user/:ip', requireAuth, (req, res) => {
    const { ip } = req.params;
    let users = readJson(USERS_FILE);

    if (!users[ip]) {
        return res.status(404).json({ message: "User not found" });
    }

    delete users[ip];
    writeJson(USERS_FILE, users);

    res.json({ message: "User deleted successfully" });
});

// Reset user attempts (protected)
app.post('/api/admin/user/:ip/reset', requireAuth, (req, res) => {
    const { ip } = req.params;
    let users = readJson(USERS_FILE);

    if (!users[ip]) {
        return res.status(404).json({ message: "User not found" });
    }

    users[ip].attempts = 0;
    users[ip].rewards = [];
    users[ip].claimed = false;
    delete users[ip].finalReward;

    writeJson(USERS_FILE, users);

    res.json({ message: "User attempts reset successfully", user: users[ip] });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
