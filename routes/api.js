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
 * Lọc danh sách trận đấu đã lưu
 */
function getSaves() {
  try {
    if (!fs.existsSync(SAVES_LIST_FILE)) {
      fs.writeFileSync(SAVES_LIST_FILE, '[]', 'utf8');
      return [];
    }
    return JSON.parse(fs.readFileSync(SAVES_LIST_FILE, 'utf8')) || [];
  } catch (e) {
    return [];
  }
}

/**
 * Lưu danh sách trận đấu đã lưu xuống ổ đĩa
 */
function saveSaves(saves) {
  fs.writeFileSync(SAVES_LIST_FILE, JSON.stringify(saves, null, 2), 'utf8');
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
      res.json({ success: true, token: 'nexus-token-' + Date.now() });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
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
  res.json(getSaves());
});

router.post('/saves', (req, res) => {
  try {
    const saves = getSaves();
    const newSave = {
      id: 'save_' + Date.now(),
      name: `${state.score.teamA.name} vs ${state.score.teamB.name} (${new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })})`,
      timestamp: Date.now(),
      rosters: JSON.parse(JSON.stringify(state.rosters)),
      score: JSON.parse(JSON.stringify(state.score)),
      tournament: JSON.parse(JSON.stringify(state.tournament))
    };
    saves.push(newSave);
    saveSaves(saves);
    res.json({ ok: true, save: newSave });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/saves/:id/load', (req, res) => {
  try {
    const saves = getSaves();
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
    const saves = getSaves();
    const filtered = saves.filter(s => s.id !== req.params.id);
    saveSaves(filtered);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/saves/:id/sync-sheets', async (req, res) => {
  try {
    const { tabName } = req.body;
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    if (!settings.googleAppsScriptUrl) {
      return res.status(400).json({ error: 'Vui lòng cấu hình Google Apps Script Web App URL trong Cài đặt (Settings) trước khi đồng bộ!' });
    }

    const saves = getSaves();
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
    saveSaves(saves);

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

router.post('/characters', (req, res) => {
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

router.post('/weapons', (req, res) => {
  const data = JSON.stringify(req.body, null, 2);
  fs.writeFile(WEAPON_FILE, data, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to save weapon data' });
    res.json({ ok: true });
  });
});

// ── Settings API ──
router.get('/settings', (req, res) => {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ obsToken: 'kdstream2026' }));
    }
    const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to read settings' });
  }
});

router.post('/settings', (req, res) => {
  try {
    let currentSettings = {};
    if (fs.existsSync(SETTINGS_FILE)) {
      currentSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
    const updatedSettings = { ...currentSettings, ...req.body };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updatedSettings, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;
