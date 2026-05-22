const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const state = require('../services/state');
const { broadcast } = require('../services/wsService');

const STATE_SAVE_FILE = path.join(__dirname, '../data/state_save.json');
const SAVES_LIST_FILE = path.join(__dirname, '../data/saved_rosters.json');
const CHAR_FILE = path.join(__dirname, '../data-local/character_local.json');
const WEAPON_FILE = path.join(__dirname, '../data-local/weapons_local.json');
const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');

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
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      const defToken = 'kdone_' + Math.random().toString(36).substring(2, 10);
      const def = { "1": { "obsToken": "kdstream2026" } };
      if (userId !== '1') {
        def[userId] = { "obsToken": defToken };
      }
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(def, null, 2), 'utf8');
      return def[userId] || { "obsToken": "kdstream2026" };
    }
    const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
    if (!content.trim()) {
      const defToken = 'kdone_' + Math.random().toString(36).substring(2, 10);
      const def = {};
      def[userId] = { "obsToken": userId === '1' ? 'kdstream2026' : defToken };
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(def, null, 2), 'utf8');
      return def[userId];
    }
    const allSettings = JSON.parse(content);
    
    // Legacy migration
    if (allSettings && !allSettings['1'] && (allSettings.obsToken || allSettings.googleAppsScriptUrl)) {
      if (userId === '1') {
        return allSettings;
      } else {
        const defToken = 'kdone_' + Math.random().toString(36).substring(2, 10);
        const migrated = { '1': allSettings };
        migrated[userId] = { "obsToken": defToken };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(migrated, null, 2), 'utf8');
        return migrated[userId];
      }
    }
    
    // Generate obsToken if not exists for the user
    if (!allSettings[userId]) {
      const defToken = 'kdone_' + Math.random().toString(36).substring(2, 10);
      allSettings[userId] = { "obsToken": userId === '1' ? 'kdstream2026' : defToken };
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(allSettings, null, 2), 'utf8');
    } else if (!allSettings[userId].obsToken) {
      allSettings[userId].obsToken = userId === '1' ? 'kdstream2026' : ('kdone_' + Math.random().toString(36).substring(2, 10));
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(allSettings, null, 2), 'utf8');
    }
    
    return allSettings[userId];
  } catch (e) {
    return { "obsToken": "kdstream2026" };
  }
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
 * Lọc danh sách trận đấu đã lưu theo User ID (Single-File)
 */
function getSaves(userId) {
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
      return userId === '1' ? allSaves : [];
    }
    return allSaves[userId] || [];
  } catch (e) {
    return [];
  }
}

/**
 * Lưu danh sách trận đấu đã lưu xuống ổ đĩa theo User ID (Single-File)
 */
function saveSaves(userId, userSaves) {
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
    allSaves[userId] = userSaves;
    fs.writeFileSync(SAVES_LIST_FILE, JSON.stringify(allSaves, null, 2), 'utf8');
  } catch (e) {
    console.error('[SYSTEM] Error saving saves:', e);
  }
}

// ── Auth Endpoint ──
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  try {
    const usersPath = path.join(__dirname, '../data/users.json');
    if (!fs.existsSync(usersPath)) {
      return res.status(401).json({ success: false, message: 'No users configured' });
    }
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      // Tự động dọn sạch state trong RAM và trên file state_save.json khi đăng nhập thành công
      try {
        const stateService = require('../services/stateService');
        stateService.resetState();
      } catch (errReset) {
        console.error('[SYSTEM] Error resetting state during login:', errReset.message);
      }

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
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// API dọn sạch dữ liệu thủ công hoặc khi đăng xuất
router.post('/reset-state', (req, res) => {
  try {
    const stateService = require('../services/stateService');
    stateService.resetState();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset state: ' + err.message });
  }
});

// ── REST API State ──
router.get('/state', (req, res) => res.json(state));

router.post('/state', (req, res) => {
  Object.assign(state, req.body);
  broadcast({ type: 'init', data: state });
  res.json({ ok: true });
});

// Lưu toàn bộ tournament state vào ổ đĩa để duy trì phiên
router.post('/save-state', (req, res) => {
  try {
    fs.writeFileSync(STATE_SAVE_FILE, JSON.stringify(state, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to write state save file: ' + err.message });
  }
});

// ── Saves List API (Multi-Save Slot Support) ──
router.get('/saves', (req, res) => {
  const userId = getUserIdFromRequest(req);
  res.json(getSaves(userId));
});

router.post('/saves', (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const saves = getSaves(userId);
    const newSave = {
      id: 'save_' + Date.now(),
      name: `${state.score.teamA.name} vs ${state.score.teamB.name} (${new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })})`,
      timestamp: Date.now(),
      rosters: JSON.parse(JSON.stringify(state.rosters)),
      score: JSON.parse(JSON.stringify(state.score)),
      tournament: JSON.parse(JSON.stringify(state.tournament))
    };
    saves.push(newSave);
    saveSaves(userId, saves);
    res.json({ ok: true, save: newSave });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/saves/:id/load', (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const saves = getSaves(userId);
    const save = saves.find(s => s.id === req.params.id);
    if (!save) {
      return res.status(404).json({ error: 'Roster save slot not found' });
    }

    // Cập nhật live state trong RAM
    state.rosters = JSON.parse(JSON.stringify(save.rosters));
    state.score = JSON.parse(JSON.stringify(save.score));
    if (save.tournament) {
      state.tournament = JSON.parse(JSON.stringify(save.tournament));
    }

    // Phát broadcast cập nhật ngay lập tức đến toàn bộ giao diện điều khiển & overlay
    broadcast({ type: 'init', data: state });

    // Đồng thời đồng bộ lưu trữ tệp trạng thái active
    fs.writeFileSync(STATE_SAVE_FILE, JSON.stringify(state, null, 2), 'utf8');

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/saves/:id', (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const saves = getSaves(userId);
    const filtered = saves.filter(s => s.id !== req.params.id);
    saveSaves(userId, filtered);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/saves/:id/sync-sheets', async (req, res) => {
  try {
    const { tabName } = req.body;
    const userId = getUserIdFromRequest(req);
    const settings = getSettings(userId);
    if (!settings.googleAppsScriptUrl) {
      return res.status(400).json({ error: 'Vui lòng cấu hình Google Apps Script Web App URL trong Cài đặt (Settings) trước khi đồng bộ!' });
    }

    const saves = getSaves(userId);
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
      players: playersPayload
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
    saveSaves(userId, saves);

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

// ── Character API ──
router.get('/characters', (req, res) => {
  fs.readFile(CHAR_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read character data' });
    res.json(JSON.parse(data));
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
    res.json(JSON.parse(data));
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
    saveSettings(userId, req.body);
    broadcast({ type: 'settings_update', userId: userId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;
