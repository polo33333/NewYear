const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4100;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// Probability Logic
const pickReward = (rewards) => {
    const random = Math.random();
    let currentProb = 0;
    for (const reward of rewards) {
        currentProb += reward.probability;
        if (random <= currentProb) {
            return reward;
        }
    }
    return rewards[0]; // Fallback
};

// Get User IP
const getUserIp = (req) => {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
};

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

    user.claimed = true;
    user.finalReward = bestReward;

    users[ip] = user;
    writeJson(USERS_FILE, users);

    res.json({
        message: "Reward claimed successfully!",
        reward: bestReward
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
