const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const { states, createDefaultState, getRoomId } = require('../services/state');
const { broadcast } = require('../services/wsService');

// Rate limiter: tối đa 10 lần login thất bại trong 15 phút
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.' }
});

const STATE_SAVE_FILE = path.join(__dirname, '../data/state_save.json');
const SAVES_LIST_FILE = path.join(__dirname, '../data/saved_rosters.json');
const CHAR_FILE = path.join(__dirname, '../data-local/character_local.json');
const WEAPON_FILE = path.join(__dirname, '../data-local/weapons_local.json');
const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');
const BRACKET_FILE = path.join(__dirname, '../data/bracket_save.json');

/**
 * Trích xuất User ID từ Request (Header X-User-Id hoặc Authorization token hoặc Query param)
 */
function getUserIdFromRequest(req) {
  if (req.headers['x-user-id']) {
    return String(req.headers['x-user-id']);
  }

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const parts = token.split('-');
    if (parts.length >= 3 && parts[0] === 'kdone' && parts[1] === 'token') {
      return String(parts[2]);
    }
  }

  if (req.query.userId) {
    return String(req.query.userId);
  }

  return '1';
}

/**
 * Trích xuất Token từ Request (Authorization header Bearer hoặc Query param)
 */
function getTokenFromRequest(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  if (req.query.token) {
    return String(req.query.token);
  }
  return null;
}

/**
 * Kiểm tra xem user hiện tại có quyền Admin hay không
 */
function checkIfAdmin(req) {
  const userId = getUserIdFromRequest(req);
  try {
    const usersPath = path.join(__dirname, '../data/users.json');
    if (!fs.existsSync(usersPath)) return false;
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    const user = users.find(u => String(u.id) === String(userId));
    return user && user.isAdmin === true;
  } catch (e) {
    return false;
  }
}

/**
 * Kiểm tra xem user hiện tại có quyền Admin hoặc Streamer hay không
 */
function checkIfAdminOrStream(req) {
  const userId = getUserIdFromRequest(req);
  try {
    const usersPath = path.join(__dirname, '../data/users.json');
    if (!fs.existsSync(usersPath)) return false;
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    const user = users.find(u => String(u.id) === String(userId));
    if (!user) return false;
    return user.isAdmin === true || 
           user.isStream === true || 
           user.isStreamer === true || 
           user.username === 'streamer';
  } catch (e) {
    return false;
  }
}


/**
 * Middleware yêu cầu quyền Admin
 */
function requireAdmin(req, res, next) {
  if (checkIfAdmin(req)) {
    next();
  } else {
    res.status(403).json({ error: 'Quyền truy cập bị từ chối: Chỉ Admin mới có thể thực hiện hành động này.' });
  }
}


/**
 * Lọc cấu hình cài đặt theo User ID (Single-File)
 */
function getSettings(userId) {
  let settingsObj = { "obsToken": "kdstream2026" };
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      const defToken = 'kdone_' + Math.random().toString(36).substring(2, 10);
      const def = { "1": { "obsToken": "kdstream2026" } };
      if (userId !== '1') {
        def[userId] = { "obsToken": defToken };
      }
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(def, null, 2), 'utf8');
      settingsObj = def[userId] || { "obsToken": "kdstream2026" };
    } else {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
      if (!content.trim()) {
        const defToken = 'kdone_' + Math.random().toString(36).substring(2, 10);
        const def = {};
        def[userId] = { "obsToken": userId === '1' ? 'kdstream2026' : defToken };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(def, null, 2), 'utf8');
        settingsObj = def[userId];
      } else {
        const allSettings = JSON.parse(content);

        // Legacy migration
        if (allSettings && !allSettings['1'] && (allSettings.obsToken || allSettings.googleAppsScriptUrl)) {
          if (userId === '1') {
            settingsObj = allSettings;
          } else {
            const defToken = 'kdone_' + Math.random().toString(36).substring(2, 10);
            const migrated = { '1': allSettings };
            migrated[userId] = { "obsToken": defToken };
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(migrated, null, 2), 'utf8');
            settingsObj = migrated[userId];
          }
        } else {
          // Generate obsToken if not exists for the user
          if (!allSettings[userId]) {
            const defToken = 'kdone_' + Math.random().toString(36).substring(2, 10);
            allSettings[userId] = { "obsToken": userId === '1' ? 'kdstream2026' : defToken };
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(allSettings, null, 2), 'utf8');
          } else if (!allSettings[userId].obsToken) {
            allSettings[userId].obsToken = userId === '1' ? 'kdstream2026' : ('kdone_' + Math.random().toString(36).substring(2, 10));
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(allSettings, null, 2), 'utf8');
          }
          settingsObj = allSettings[userId];
        }
      }
    }
  } catch (e) {
    settingsObj = { "obsToken": "kdstream2026" };
  }

  // Đọc thêm isSync từ users.json
  let isSync = false;
  try {
    const usersPath = path.join(__dirname, '../data/users.json');
    if (fs.existsSync(usersPath)) {
      const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      const user = users.find(u => String(u.id) === String(userId));
      if (user) {
        isSync = !!user.isSync;
      }
    }
  } catch (e) {
    console.error('[API] Error reading users.json for settings:', e.message);
  }

  return { ...settingsObj, isSync };
}

/**
 * Lưu cấu hình cài đặt theo User ID (Single-File)
 */
function saveSettings(userId, userSettings) {
  try {
    let allSettings = {};
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
      if (content.trim()) {
        const parsed = JSON.parse(content);
        if (parsed && !parsed['1'] && (parsed.obsToken || parsed.googleAppsScriptUrl)) {
          allSettings = { '1': parsed };
        } else {
          allSettings = parsed;
        }
      }
    }
    allSettings[userId] = { ...allSettings[userId], ...userSettings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(allSettings, null, 2), 'utf8');
  } catch (e) {
    console.error('[SYSTEM] Error saving settings:', e);
  }
}

/**
 * Lọc cấu hình sơ đồ giải đấu theo Room ID
 */
function getBracket(roomId) {
  try {
    if (!fs.existsSync(BRACKET_FILE)) {
      fs.writeFileSync(BRACKET_FILE, '{}', 'utf8');
      return { nodes: [], connections: [], panZoom: { x: 0, y: 0, scale: 1 } };
    }
    const content = fs.readFileSync(BRACKET_FILE, 'utf8');
    if (!content.trim()) return { nodes: [], connections: [], panZoom: { x: 0, y: 0, scale: 1 } };
    const allBrackets = JSON.parse(content);
    return allBrackets[roomId] || { nodes: [], connections: [], panZoom: { x: 0, y: 0, scale: 1 } };
  } catch (e) {
    return { nodes: [], connections: [], panZoom: { x: 0, y: 0, scale: 1 } };
  }
}

/**
 * Lưu cấu hình sơ đồ giải đấu theo Room ID
 */
function saveBracket(roomId, bracketData) {
  try {
    let allBrackets = {};
    if (fs.existsSync(BRACKET_FILE)) {
      const content = fs.readFileSync(BRACKET_FILE, 'utf8');
      if (content.trim()) {
        allBrackets = JSON.parse(content);
      }
    }
    allBrackets[roomId] = bracketData;
    fs.writeFileSync(BRACKET_FILE, JSON.stringify(allBrackets, null, 2), 'utf8');
  } catch (e) {
    console.error('[SYSTEM] Error saving bracket:', e);
  }
}

/**
 * Lọc danh sách trận đấu đã lưu theo Room ID (Single-File)
 */
function getSaves(roomId) {
  try {
    if (!fs.existsSync(SAVES_LIST_FILE)) {
      fs.writeFileSync(SAVES_LIST_FILE, '{}', 'utf8');
      return [];
    }
    const content = fs.readFileSync(SAVES_LIST_FILE, 'utf8');
    if (!content.trim()) return [];
    const allSaves = JSON.parse(content);
    if (Array.isArray(allSaves)) {
      // Legacy format migration
      return roomId === '1' ? allSaves : [];
    }
    return allSaves[roomId] || [];
  } catch (e) {
    return [];
  }
}

/**
 * Lưu danh sách trận đấu đã lưu xuống ổ đĩa theo Room ID (Single-File)
 */
function saveSaves(roomId, userSaves) {
  try {
    let allSaves = {};
    if (fs.existsSync(SAVES_LIST_FILE)) {
      const content = fs.readFileSync(SAVES_LIST_FILE, 'utf8');
      if (content.trim()) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          allSaves = { '1': parsed };
        } else {
          allSaves = parsed;
        }
      }
    }
    allSaves[roomId] = userSaves;
    fs.writeFileSync(SAVES_LIST_FILE, JSON.stringify(allSaves, null, 2), 'utf8');
  } catch (e) {
    console.error('[SYSTEM] Error saving saves:', e);
  }
}

// ── Auth Endpoint ──
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username và password không được để trống.' });
  }
  try {
    const usersPath = path.join(__dirname, '../data/users.json');
    if (!fs.existsSync(usersPath)) {
      return res.status(401).json({ success: false, message: 'No users configured' });
    }
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    const user = users.find(u => u.username === username);

    // So sánh password: hỗ trợ cả bcrypt hash (bắt đầu bằng $2b$) và plain-text legacy
    let passwordMatch = false;
    if (user) {
      if (user.password && user.password.startsWith('$2b$')) {
        passwordMatch = await bcrypt.compare(password, user.password);
      } else {
        // Legacy plain-text (sẽ bị xóa sau khi migrate)
        passwordMatch = user.password === password;
      }
    }

    if (user && passwordMatch) {
      res.json({
        success: true,
        token: `kdone-token-${user.id}-${Date.now()}`,
        user: {
          id: user.id,
          username: user.username,
          isAdmin: !!user.isAdmin
        }
      });
    } else {
      res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }
  } catch (err) {
    console.error('[AUTH] Login error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Middleware tự động gán roomId cho các API liên quan tới trạng thái đấu
router.use((req, res, next) => {
  const path = req.path;
  if (path.startsWith('/bracket/public') || path.startsWith('/saves/public')) {
    return next();
  }
  if (
    path.startsWith('/state') ||
    path.startsWith('/save-state') ||
    path.startsWith('/saves') ||
    path.startsWith('/reset-state') ||
    path.startsWith('/bracket')
  ) {
    const userId = getUserIdFromRequest(req);
    const token = getTokenFromRequest(req);
    const queryRoomId = req.headers['x-room-id'] || req.query.roomId;
    const roomId = getRoomId(userId, token, queryRoomId);

    req.roomId = roomId;
    res.setHeader('X-Room-Id', roomId);

    // Đảm bảo states[roomId] luôn được khởi tạo
    if (!states[roomId]) {
      states[roomId] = createDefaultState();
    }
  }
  next();
});

// API dọn sạch dữ liệu thủ công hoặc khi đăng xuất
router.post('/reset-state', (req, res) => {
  try {
    const roomId = req.roomId;
    const userId = getUserIdFromRequest(req);

    // Đếm số thiết bị Control Panel đang hoạt động trong room này qua socket
    const wsService = require('../services/wsService');
    const activeControlCount = wsService.getActiveControlsCount(roomId);

    // Nếu vẫn còn thiết bị Control Panel khác đang hoạt động trong room này, giữ nguyên trạng thái
    if (activeControlCount > 1) {
      console.log(`[SYSTEM] User logged out but room ${roomId} still has ${activeControlCount} active Control Panel(s). Keeping state.`);
      return res.json({ ok: true, message: 'Keep state' });
    }

    // Kiểm tra cấu hình isSync của user trong users.json
    let isSync = false;
    try {
      const usersPath = path.join(__dirname, '../data/users.json');
      if (fs.existsSync(usersPath)) {
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const user = users.find(u => String(u.id) === String(userId));
        if (user) {
          isSync = !!user.isSync;
        }
      }
    } catch (e) {
      console.error('[API] Error reading users.json for reset-state:', e.message);
    }

    if (states[roomId]) {
      states[roomId].scene = 'end';
      broadcast({ type: 'scene', value: 'end' }, roomId);
    }

    if (isSync) {
      // Tài khoản sync: giữ state trên RAM để đăng nhập lại dùng tiếp (không xóa)
      console.log(`[SYSTEM] Synced room ${roomId}: keeping state in RAM after logout.`);
    } else {
      // Tài khoản độc lập (isSync == false): dọn sạch state khỏi RAM
      console.log(`[SYSTEM] Independent room ${roomId}: deleting state after logout.`);
      delete states[roomId];
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset state: ' + err.message });
  }
});

// ── REST API State ──
router.get('/state', (req, res) => {
  res.json(states[req.roomId]);
});

router.post('/state', (req, res) => {
  const roomId = req.roomId;
  Object.assign(states[roomId], req.body);
  broadcast({ type: 'init', data: states[roomId] }, roomId);
  res.json({ ok: true });
});

// Lưu toàn bộ tournament state vào ổ đĩa để duy trì phiên
router.post('/save-state', (req, res) => {
  // RAM-Only: Do not save to disk, state changes are already persistent in RAM.
  res.json({ ok: true });
});

// ── Saves List API (Multi-Save Slot Support) ──
router.get('/saves', (req, res) => {
  res.json(getSaves(req.roomId));
});

router.post('/saves', (req, res) => {
  try {
    const roomId = req.roomId;
    const saves = getSaves(roomId);
    const uState = states[roomId];
    const newSave = {
      id: 'save_' + Date.now(),
      name: `${uState.score.teamA.name} vs ${uState.score.teamB.name} (${new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })})`,
      timestamp: Date.now(),
      rosters: JSON.parse(JSON.stringify(uState.rosters)),
      score: JSON.parse(JSON.stringify(uState.score)),
      tournament: JSON.parse(JSON.stringify(uState.tournament))
    };
    saves.push(newSave);
    saveSaves(roomId, saves);
    res.json({ ok: true, save: newSave });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/saves/:id/load', (req, res) => {
  try {
    const roomId = req.roomId;
    const saves = getSaves(roomId);
    const save = saves.find(s => s.id === req.params.id);
    if (!save) {
      return res.status(404).json({ error: 'Roster save slot not found' });
    }

    const uState = states[roomId];

    // Cập nhật live state trong RAM
    uState.rosters = JSON.parse(JSON.stringify(save.rosters));
    uState.score = JSON.parse(JSON.stringify(save.score));
    if (save.tournament) {
      uState.tournament = JSON.parse(JSON.stringify(save.tournament));
    }

    // Phát broadcast cập nhật ngay lập tức đến toàn bộ giao diện điều khiển & overlay
    broadcast({ type: 'init', data: uState }, roomId);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/saves/:id', (req, res) => {
  try {
    const roomId = req.roomId;
    const saves = getSaves(roomId);
    const filtered = saves.filter(s => s.id !== req.params.id);
    saveSaves(roomId, filtered);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/saves/:id/sync-sheets', async (req, res) => {
  try {
    const { tabName } = req.body;
    const roomId = req.roomId;
    const userId = getUserIdFromRequest(req);
    const settings = getSettings(userId);
    if (!settings.googleAppsScriptUrl) {
      return res.status(400).json({ error: 'Vui lòng cấu hình Google Apps Script Web App URL trong Cài đặt (Settings) trước khi đồng bộ!' });
    }

    const saves = getSaves(roomId);
    const save = saves.find(s => s.id === req.params.id);
    if (!save) {
      return res.status(404).json({ error: 'Không tìm thấy dữ liệu lưu trữ trận đấu!' });
    }

    // Đọc nhân vật và vũ khí để tính chi tiết điểm số bị giảm trừ
    let allChars = [];
    let allWeapons = [];
    try {
      if (fs.existsSync(CHAR_FILE)) allChars = JSON.parse(fs.readFileSync(CHAR_FILE, 'utf8'));
      if (fs.existsSync(WEAPON_FILE)) allWeapons = JSON.parse(fs.readFileSync(WEAPON_FILE, 'utf8'));
    } catch (e) {
      console.error('Error loading characters or weapons for sync:', e);
    }

    const playersPayload = [];

    ['teamA', 'teamB'].forEach(teamKey => {
      const playerName = save.score?.[teamKey]?.name || (teamKey === 'teamA' ? 'TEAM A' : 'TEAM B');
      const teamRosters = save.rosters?.[teamKey] || {};

      const usedChars = new Set();
      const usedWeapons = new Set();
      const roundsPayload = [];
      let calculatedTotal = 0;

      for (let r = 1; r <= 6; r++) {
        const roundData = teamRosters[`round${r}`] || { heroes: [], heroRcs: [], weapons: [], weaponRs: [], points: 0, deduction: 0 };

        let roundWeaponDeduction = 0;
        let roundRcDeductions = [0, 0, 0, 0, 0, 0];
        let roundRcCounts = [0, 0, 0, 0, 0, 0];

        // Tính trừ điểm nhân vật RC & đếm RC cấp độ trong round
        const heroes = roundData.heroes || [];
        const heroRcs = roundData.heroRcs || [];
        for (let i = 0; i < 3; i++) {
          const hName = heroes[i];
          if (hName && hName.trim()) {
            const rcVal = parseInt(heroRcs[i], 10) || 0;
            if (rcVal >= 1 && rcVal <= 6) {
              roundRcCounts[rcVal - 1]++;

              if (!usedChars.has(hName)) {
                usedChars.add(hName);
                const charObj = allChars.find(c => c.name === hName);
                if (charObj) {
                  const cost = parseInt(charObj[`rc${rcVal}`], 10) || 0;
                  roundRcDeductions[rcVal - 1] += cost;
                }
              }
            } else {
              if (!usedChars.has(hName)) {
                usedChars.add(hName);
              }
            }
          }
        }

        const roundRcTicks = roundRcCounts.map(count => count > 0 ? count : "");

        // Tính trừ điểm vũ khí sử dụng trong round
        const rWeapons = roundData.weapons || [];
        const weaponRs = roundData.weaponRs || [];
        for (let i = 0; i < 3; i++) {
          const wName = rWeapons[i];
          if (wName && wName.trim() && !usedWeapons.has(wName)) {
            usedWeapons.add(wName);
            const rVal = parseInt(weaponRs[i], 10) || 1;
            const weaponObj = allWeapons.find(w => w.name === wName);
            if (weaponObj) {
              const cost = parseInt(weaponObj[`r${rVal}`], 10) || 0;
              roundWeaponDeduction += cost;
            }
          }
        }

        // Tính toán các điểm phụ trừ khác
        const extraDeduction = parseInt(roundData.buyPoints, 10) || 0;
        const totalSavedDeduction = (parseInt(roundData.deduction, 10) || 0) + extraDeduction;

        const baseScore = parseInt(roundData.points, 10) || 0;
        const squadTotal = baseScore - totalSavedDeduction;
        calculatedTotal += squadTotal;

        roundsPayload.push({
          roundNum: r,
          resonators: heroes.filter(h => h && h.trim()),
          baseScore: baseScore,
          weaponDeduction: roundWeaponDeduction,
          rcDeductions: roundRcTicks,
          extraDeduction: extraDeduction,
          squadTotal: squadTotal
        });
      }

      playersPayload.push({
        name: playerName,
        rounds: roundsPayload,
        totalScore: calculatedTotal
      });
    });

    const payload = {
      id: save.id,
      timestamp: save.timestamp,
      bracket: save.tournament?.bracketLabel || 'TOURNAMENT MATCH',
      tabName: tabName || 'Match History',
      players: playersPayload,
      characters: allChars.map(c => ({ name: c.name, element: c.element }))
    };

    console.log('[SHEETS] Syncing match to Google Sheets via:', settings.googleAppsScriptUrl);

    const response = await fetch(settings.googleAppsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script returned status ${response.status}`);
    }

    // Save synced tab name as soon as response is ok
    save.syncedTabs = save.syncedTabs || [];
    if (!save.syncedTabs.includes(tabName)) {
      save.syncedTabs.push(tabName);
    }
    saveSaves(roomId, saves);

    let result = { ok: true };
    try {
      result = await response.json();
    } catch (e) {
      console.warn('[SHEETS] Google response was not JSON:', e.message);
    }

    res.json({ ok: true, result });
  } catch (err) {
    console.error('[SHEETS] Error syncing match details:', err);
    res.status(500).json({ error: 'Lỗi đồng bộ Google Sheets: ' + err.message });
  }
});

// ── Ping endpoint (dùng để đo latency, không tải full state) ──
router.get('/ping', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// ── Character API ──
router.get('/characters', (req, res) => {
  fs.readFile(CHAR_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read character data' });
    try {
      res.json(JSON.parse(data));
    } catch (e) {
      console.error('[API] character_local.json parse error:', e.message);
      res.status(500).json({ error: 'Character data file is corrupted' });
    }
  });
});

router.post('/characters', requireAdmin, (req, res) => {
  const data = JSON.stringify(req.body, null, 2);
  fs.writeFile(CHAR_FILE, data, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to save character data' });
    res.json({ ok: true });
  });
});

// ── Weapons API ──
router.get('/weapons', (req, res) => {
  fs.readFile(WEAPON_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read weapon data' });
    try {
      res.json(JSON.parse(data));
    } catch (e) {
      console.error('[API] weapons_local.json parse error:', e.message);
      res.status(500).json({ error: 'Weapon data file is corrupted' });
    }
  });
});

router.post('/weapons', requireAdmin, (req, res) => {
  const data = JSON.stringify(req.body, null, 2);
  fs.writeFile(WEAPON_FILE, data, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to save weapon data' });
    res.json({ ok: true });
  });
});

// ── Settings API ──
router.get('/settings', (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    res.json(getSettings(userId));
  } catch (err) {
    res.status(500).json({ error: 'Failed to read settings' });
  }
});

router.post('/settings', (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const token = getTokenFromRequest(req);
    const roomId = getRoomId(userId, token);
    const { isSync, ...otherSettings } = req.body;

    saveSettings(userId, otherSettings);

    // Lưu isSync vào users.json nếu được truyền lên
    if (isSync !== undefined) {
      const usersPath = path.join(__dirname, '../data/users.json');
      if (fs.existsSync(usersPath)) {
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const user = users.find(u => String(u.id) === String(userId));
        if (user) {
          user.isSync = !!isSync;
          fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
        }
      }
    }

    broadcast({ type: 'settings_update', userId: userId }, roomId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings: ' + err.message });
  }
});

// ── Bracket Editor API ──
router.get('/bracket', (req, res) => {
  const userId = getUserIdFromRequest(req);
  const bracket = getBracket(req.roomId);

  // If the bracket has a creatorId, check ownership
  if (bracket.creatorId && String(bracket.creatorId) !== String(userId)) {
    // If not the creator, only allow Admin or Streamer
    if (!checkIfAdminOrStream(req)) {
      return res.json({ nodes: [], connections: [], panZoom: { x: 100, y: 100, scale: 1 }, error: 'Bạn không có quyền xem sơ đồ này!' });
    }
  }

  res.json(bracket);
});

router.post('/bracket', (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const existingBracket = getBracket(req.roomId);

    // If the bracket has a creatorId, check ownership for modification
    if (existingBracket.creatorId && String(existingBracket.creatorId) !== String(userId)) {
      if (!checkIfAdminOrStream(req)) {
        return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa sơ đồ này!' });
      }
    }

    const bracketData = req.body;
    // Keep original creatorId or set to current user if new
    bracketData.creatorId = existingBracket.creatorId || userId;

    saveBracket(req.roomId, bracketData);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public read-only endpoints (bypasses room & user checks, defaults to Room "room_1")
router.get('/bracket/public', (req, res) => {
  try {
    const roomId = req.query.roomId || 'room_1';
    const bracket = getBracket(roomId);
    res.json(bracket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/saves/public', (req, res) => {
  try {
    const roomId = req.query.roomId || 'room_1';
    const saves = getSaves(roomId);
    res.json(saves);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
