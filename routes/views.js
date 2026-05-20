const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');

/**
 * Lấy token OBS hiện tại từ settings
 */
const getObsToken = () => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')).obsToken || 'kdstream2026';
    }
    return 'kdstream2026';
  } catch (e) {
    return 'kdstream2026';
  }
};

/**
 * Middleware kiểm tra token bảo mật cho OBS Overlays
 */
const requireObsToken = (req, res, next) => {
  if (req.query.token === getObsToken()) {
    next();
  } else {
    res.status(403).send('Forbidden: Missing or invalid token');
  }
};

// Control Panel
router.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/control.html')));

// Login
router.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));

// OBS Overlay — Full Overlay
router.get('/live', requireObsToken, (req, res) => res.sendFile(path.join(__dirname, '../public/overlay.html')));

// Standalone Components
router.get('/scoreboard', requireObsToken, (req, res) => res.sendFile(path.join(__dirname, '../public/scoreboard.html')));
router.get('/ticker', requireObsToken, (req, res) => res.sendFile(path.join(__dirname, '../public/ticker.html')));
router.get('/stats', requireObsToken, (req, res) => res.sendFile(path.join(__dirname, '../public/stats.html')));

// Server-side redirect to main layout for client-side routing (SPA)
router.get('/character-editor', (req, res) => res.sendFile(path.join(__dirname, '../public/control.html')));
router.get('/weapon-editor', (req, res) => res.sendFile(path.join(__dirname, '../public/control.html')));
router.get('/history', (req, res) => res.sendFile(path.join(__dirname, '../public/control.html')));
router.get('/settings', (req, res) => res.sendFile(path.join(__dirname, '../public/control.html')));

// Standalone music player (kept for legacy support)
router.get('/music-player', (req, res) => res.sendFile(path.join(__dirname, '../public/music-player.html')));

module.exports = {
  router,
  getObsToken
};
