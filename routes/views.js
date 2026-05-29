const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');

/**
 * Lấy token OBS của một user (mặc định user ID 1) để tương thích hiển thị thông báo khởi động server
 */
const getObsToken = (userId = '1') => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
      if (!content.trim()) return 'kdstream2026';
      const allSettings = JSON.parse(content);
      if (allSettings && !allSettings['1'] && (allSettings.obsToken || allSettings.googleAppsScriptUrl)) {
        return allSettings.obsToken || 'kdstream2026';
      }
      return (allSettings[userId] && allSettings[userId].obsToken) || 'kdstream2026';
    }
    return 'kdstream2026';
  } catch (e) {
    return 'kdstream2026';
  }
};

/**
 * Kiểm tra xem token OBS có hợp lệ với bất kỳ user nào trong settings hay không
 */
const isValidObsToken = (token) => {
  try {
    if (!token) return false;
    
    // Chấp nhận token đăng nhập của Control Panel khi isSync là false
    const parts = token.split('-');
    if (parts.length >= 3 && parts[0] === 'kdone' && parts[1] === 'token') {
      return true;
    }

    if (!fs.existsSync(SETTINGS_FILE)) {
      return token === 'kdstream2026';
    }
    const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
    if (!content.trim()) {
      return token === 'kdstream2026';
    }
    const allSettings = JSON.parse(content);
    
    // Legacy check
    if (allSettings && !allSettings['1'] && (allSettings.obsToken || allSettings.googleAppsScriptUrl)) {
      return token === (allSettings.obsToken || 'kdstream2026');
    }
    
    // Quét qua tất cả user
    for (const userId in allSettings) {
      if (allSettings[userId] && allSettings[userId].obsToken === token) {
        return true;
      }
    }
    
    return token === 'kdstream2026';
  } catch (e) {
    return token === 'kdstream2026';
  }
};

/**
 * Middleware kiểm tra token bảo mật cho OBS Overlays
 */
const requireObsToken = (req, res, next) => {
  if (isValidObsToken(req.query.token)) {
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
router.get('/bracket', (req, res) => res.sendFile(path.join(__dirname, '../public/control.html')));
router.get('/settings', (req, res) => res.sendFile(path.join(__dirname, '../public/control.html')));

// Public bracket viewer
router.get('/bracket-view', (req, res) => res.sendFile(path.join(__dirname, '../public/bracket-view.html')));

// Standalone music player (kept for legacy support)
router.get('/music-player', (req, res) => res.sendFile(path.join(__dirname, '../public/music-player.html')));

module.exports = {
  router,
  getObsToken
};
