const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const http = require("http");

const app = express();
const PORT = process.env.PORT || 4100;

/* ================== MIDDLEWARE ================== */

app.use(cors());
app.use(bodyParser.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'change-this-in-prod',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false // SSL handled by nginx
    }
}));

/* ================== BLOCK DIRECT ADMIN HTML ================== */
app.use((req, res, next) => {
    if (req.path === '/admin.html') {
        return res.status(403).send('Forbidden');
    }
    next();
});

/* ================== STATIC FILES (FIX FIREFOX) ================== */
const publicDir = path.join(__dirname, 'public');

app.use(express.static(publicDir, {
    index: false,
    etag: false,
    lastModified: true,
    setHeaders: (res, filePath) => {
        const stat = fs.statSync(filePath);

        res.setHeader("Content-Length", stat.size);
        res.setHeader("Cache-Control", "no-transform");
        res.setHeader("Accept-Ranges", "bytes");
    }
}));

/* ================== DATA ================== */
const DATA_DIR = path.join(__dirname, 'data');
const REWARDS_FILE = path.join(DATA_DIR, 'rewards.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const readJson = (file) => {
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8'));
};

const writeJson = (file, data) => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

const getUserIp = (req) =>
    (req.headers['x-forwarded-for'] || '').split(',')[0] ||
    req.socket.remoteAddress;

/* ================== GAME LOGIC ================== */
const pickReward = (rewards) => {
    const available = rewards.filter(r => r.remaining > 0);
    if (!available.length) return null;

    const total = available.reduce((s, r) => s + r.probability, 0);
    let rand = Math.random() * total;

    for (const r of available) {
        rand -= r.probability;
        if (rand <= 0) return r;
    }
    return available[0];
};

/* ================== ROUTES ================== */

app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

/* ---------- API STATUS ---------- */
app.get('/api/status', (req, res) => {
    const ip = getUserIp(req);
    const users = readJson(USERS_FILE);
    const user = users[ip] || { attempts: 0, rewards: [], claimed: false };

    const bestReward = user.rewards.length
        ? user.rewards.reduce((a, b) => a.value > b.value ? a : b)
        : null;

    res.json({
        attempts: user.attempts,
        maxAttempts: 3,
        rewards: user.rewards,
        bestReward,
        claimed: user.claimed
    });
});

/* ---------- COUNTDOWN ---------- */
app.get('/api/countdown', (req, res) => {
    const config = readJson(CONFIG_FILE);
    const countdownEndTime = config.countdownEndTime || 0;
    const now = Date.now();
    const remainingMs = Math.max(0, countdownEndTime - now);

    res.json({
        countdownEndTime,
        remainingMs,
        isActive: remainingMs > 0
    });
});

/* ---------- SHAKE ---------- */
app.post('/api/shake', (req, res) => {
    const ip = getUserIp(req);
    const users = readJson(USERS_FILE);
    const rewards = readJson(REWARDS_FILE);

    users[ip] ??= { attempts: 0, rewards: [], claimed: false };

    if (users[ip].attempts >= 3)
        return res.status(400).json({ message: "Out of attempts" });

    const reward = pickReward(rewards);
    if (!reward)
        return res.status(400).json({ message: "Out of stock", outOfStock: true });

    users[ip].attempts++;
    users[ip].rewards.push({ ...reward, timestamp: Date.now() });

    writeJson(USERS_FILE, users);
    res.json({ reward, attempts: users[ip].attempts });
});

/* ---------- CLAIM ---------- */
app.post('/api/claim', (req, res) => {
    const ip = getUserIp(req);
    const users = readJson(USERS_FILE);
    const rewards = readJson(REWARDS_FILE);

    if (!users[ip])
        return res.status(400).json({ message: "Invalid claim" });

    const best = users[ip].rewards.reduce((a, b) => a.value > b.value ? a : b);
    const idx = rewards.findIndex(r => r.id === best.id);

    if (idx === -1 || rewards[idx].remaining <= 0)
        return res.status(400).json({ message: "Reward out of stock" });

    rewards[idx].remaining--;
    users[ip].claimed = true;
    users[ip].finalReward = best;

    writeJson(REWARDS_FILE, rewards);
    writeJson(USERS_FILE, users);

    res.json({ reward: best });
});

/* ================== ADMIN AUTH ================== */
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '12345678.c';

const requireAuth = (req, res, next) => {
    if (req.session?.isAdmin) return next();

    // If it's an HTML page request, redirect to login
    if (req.path.startsWith('/admin') && !req.path.startsWith('/api/')) {
        return res.redirect('/admin/login');
    }

    // For API requests, return JSON error
    res.status(401).json({ message: 'Unauthorized' });
};

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return res.json({ success: true });
    }
    res.status(401).json({ success: false });
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/auth/status', (req, res) => {
    res.json({ authenticated: !!req.session?.isAdmin });
});

/* ================== ADMIN PAGES ================== */
app.get('/admin/login', (req, res) =>
    res.sendFile(path.join(publicDir, 'admin-login.html'))
);

app.get('/admin', requireAuth, (req, res) =>
    res.sendFile(path.join(publicDir, 'admin.html'))
);

/* ================== ADMIN API ================== */

// Get all users
app.get('/api/admin/users', requireAuth, (req, res) => {
    const users = readJson(USERS_FILE);
    const userArray = Object.entries(users).map(([ip, data]) => ({
        ip,
        attempts: data.attempts || 0,
        rewards: data.rewards || [],
        claimed: data.claimed || false,
        firstSeen: data.firstSeen || Date.now()
    }));
    res.json(userArray);
});

// Get all rewards
app.get('/api/admin/rewards', requireAuth, (req, res) => {
    const rewards = readJson(REWARDS_FILE);
    res.json(rewards);
});

// Delete a user
app.delete('/api/admin/user/:ip', requireAuth, (req, res) => {
    const { ip } = req.params;
    const users = readJson(USERS_FILE);

    if (!users[ip]) {
        return res.status(404).json({ message: 'Người chơi không tồn tại' });
    }

    delete users[ip];
    writeJson(USERS_FILE, users);
    res.json({ message: 'Đã xóa người chơi thành công' });
});

// Reset a user's attempts
app.post('/api/admin/user/:ip/reset', requireAuth, (req, res) => {
    const { ip } = req.params;
    const users = readJson(USERS_FILE);

    if (!users[ip]) {
        return res.status(404).json({ message: 'Người chơi không tồn tại' });
    }

    users[ip] = {
        attempts: 0,
        rewards: [],
        claimed: false,
        firstSeen: users[ip].firstSeen || Date.now()
    };

    writeJson(USERS_FILE, users);
    res.json({ message: 'Đã reset lượt chơi thành công' });
});

// Update rewards configuration
app.put('/api/admin/rewards', requireAuth, (req, res) => {
    const { rewards } = req.body;

    if (!Array.isArray(rewards)) {
        return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
    }

    // Validate probability sum
    const totalProb = rewards.reduce((sum, r) => sum + r.probability, 0);
    if (Math.abs(totalProb - 1.0) > 0.01) {
        return res.status(400).json({
            message: `Tổng xác suất phải bằng 1.0 (hiện tại: ${totalProb.toFixed(2)})`
        });
    }

    // Validate quantities
    for (const reward of rewards) {
        if (reward.remaining > reward.quantity) {
            return res.status(400).json({
                message: `"${reward.name}": Số lượng còn lại không thể lớn hơn tổng số lượng`
            });
        }
    }

    writeJson(REWARDS_FILE, rewards);
    res.json({ message: 'Đã lưu cấu hình phần thưởng thành công', rewards });
});

// Reset reward quantities
app.post('/api/admin/rewards/reset', requireAuth, (req, res) => {
    const rewards = readJson(REWARDS_FILE);

    if (!Array.isArray(rewards) || rewards.length === 0) {
        return res.status(400).json({ message: 'Không có phần thưởng nào để reset' });
    }

    // Reset remaining to quantity for all rewards
    rewards.forEach(reward => {
        reward.remaining = reward.quantity;
    });

    writeJson(REWARDS_FILE, rewards);
    res.json({ message: 'Đã reset số lượng phần thưởng thành công', rewards });
});

// Set countdown end time
app.post('/api/admin/countdown', requireAuth, (req, res) => {
    const { endTime } = req.body;

    if (typeof endTime !== 'number' || endTime < 0) {
        return res.status(400).json({ message: 'Thời gian không hợp lệ' });
    }

    const config = readJson(CONFIG_FILE);
    config.countdownEndTime = endTime;
    writeJson(CONFIG_FILE, config);

    res.json({ message: 'Đã cập nhật thời gian đếm ngược', countdownEndTime: endTime });
});

/* ================== START SERVER ================== */
http.createServer(app).listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
