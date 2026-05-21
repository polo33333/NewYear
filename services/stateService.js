const fs = require('fs');
const path = require('path');
const state = require('./state');
const { broadcast } = require('./wsService');

const STATE_SAVE_FILE = path.join(__dirname, '../data/state_save.json');

/**
 * Khởi động logic tải lại trạng thái đã lưu & bộ mô phỏng chỉ số live stream
 */
function init() {
  // Tải trạng thái cũ đã lưu nếu tồn tại để tránh mất thông tin roster & điểm số
  try {
    if (fs.existsSync(STATE_SAVE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_SAVE_FILE, 'utf8'));
      // Merge đè thông tin cấu trúc trạng thái cũ vào state hiện tại
      Object.assign(state, saved);
      console.log('[SYSTEM] Loaded persisted state from data/state_save.json');
    }
  } catch (err) {
    console.log('[SYSTEM] Error loading persisted state:', err.message);
  }

  // ── Simulate live stats khi đang stream ──
  setInterval(() => {
    if (!state.isLive) return;
    state.stats.viewers += Math.floor(Math.random() * 20 - 8);
    state.stats.chatPerMin = Math.floor(300 + Math.random() * 100);
    state.stats.bitrate = 5800 + Math.floor(Math.random() * 400);
    state.stats.fps = Math.random() > 0.95 ? 59 : 60;
    state.stats.cpu = Math.floor(28 + Math.random() * 10);
    state.stats.gpu = Math.floor(55 + Math.random() * 15);
    state.score.matchTimer++;
    broadcast({ type: 'stats', data: state.stats });
    broadcast({ type: 'score', data: state.score });
  }, 2000);
}

/**
 * Tự động ghi trạng thái hiện tại xuống file state_save.json
 */
function saveStateToDisk() {
  try {
    fs.writeFileSync(STATE_SAVE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.log('[SYSTEM] Error auto-saving state to disk:', err.message);
  }
}

/**
 * Xử lý tin nhắn nhận được từ control panel qua WebSocket
 */
function handleWSMessage(msg) {
  let stateChanged = false;
  switch (msg.type) {
    case 'set_scene':
      state.scene = msg.value;
      broadcast({ type: 'scene', value: state.scene, senderId: msg.senderId });
      stateChanged = true;
      break;

    case 'toggle_overlay':
      state.overlays[msg.key] = !state.overlays[msg.key];
      broadcast({ type: 'overlays', data: state.overlays, senderId: msg.senderId });
      stateChanged = true;
      break;

    case 'update_score':
      state.score = { ...state.score, ...msg.data };
      broadcast({ type: 'score', data: state.score, senderId: msg.senderId });
      stateChanged = true;
      break;

    case 'update_tournament':
      state.tournament = { ...state.tournament, ...msg.data };
      broadcast({ type: 'tournament', data: state.tournament, senderId: msg.senderId });
      stateChanged = true;
      break;

    case 'update_break':
      state.break = { ...state.break, ...msg.data };
      broadcast({ type: 'break', data: state.break, senderId: msg.senderId });
      stateChanged = true;
      break;

    case 'update_ticker':
      state.ticker = { ...state.ticker, ...msg.data };
      broadcast({ type: 'ticker', data: state.ticker, senderId: msg.senderId });
      stateChanged = true;
      break;

    case 'update_roster':
      if (msg.data) {
        for (let teamKey in msg.data) {
          if (!state.rosters[teamKey]) {
            state.rosters[teamKey] = {};
          }
          state.rosters[teamKey] = {
            ...state.rosters[teamKey],
            ...msg.data[teamKey]
          };
        }

        // Recalculate total scores based ONLY on officially synced rounds in state.rosters
        let scoreA = 0;
        let scoreB = 0;
        const rosters = state.rosters || {};
        const teamA = rosters.teamA || {};
        const teamB = rosters.teamB || {};

        for (let r = 1; r <= 6; r++) {
          const roundA = teamA['round' + r];
          if (roundA) {
            const p = parseInt(roundA.points) || 0;
            const d = parseInt(roundA.deduction) || 0;
            const buy = parseInt(roundA.buyPoints) || 0;
            scoreA += (p - d - buy);
          }

          const roundB = teamB['round' + r];
          if (roundB) {
            const p = parseInt(roundB.points) || 0;
            const d = parseInt(roundB.deduction) || 0;
            const buy = parseInt(roundB.buyPoints) || 0;
            scoreB += (p - d - buy);
          }
        }

        if (!state.score) {
          state.score = {
            teamA: { name: 'Team A', logo: '🐉', color: '#00aaff', score: 0 },
            teamB: { name: 'Team B', logo: '👻', color: '#ff4444', score: 0 }
          };
        }
        if (!state.score.teamA) state.score.teamA = { score: 0 };
        if (!state.score.teamB) state.score.teamB = { score: 0 };

        state.score.teamA.score = scoreA;
        state.score.teamB.score = scoreB;

        broadcast({ type: 'score', data: state.score, senderId: msg.senderId });
      }
      broadcast({ type: 'rosters', data: state.rosters, senderId: msg.senderId });
      stateChanged = true;
      break;
  }

  if (stateChanged) {
    saveStateToDisk();
  }
}

/**
 * Đưa trạng thái về mặc định và dọn sạch dữ liệu roster/pick
 */
function resetState() {
  state.isLive = false;
  state.scene = 'gameplay';
  state.overlays = {
    scoreboard: true,
    ticker: false,
    rosterA: false,
    rosterB: false
  };
  state.rosters = {
    teamA: {},
    teamB: {}
  };
  state.score = {
    teamA: { name: 'Team A', logo: '🐉', color: '#00aaff', score: 0 },
    teamB: { name: 'Team B', logo: '👻', color: '#ff4444', score: 0 }
  };
  state.tournament = {
    name: 'MATRIX CUP 2026',
    game: 'Wuthering Waves',
    format: 'Double Elimination',
    bracketLabel: 'GRAND FINALS — MATRIX CUP 2026'
  };
  state.break = {
    duration: 300
  };
  state.ticker = {
    items: [
      '🏆 Grand Finals — Team A vs Team B',
      '🎮 Game 3 Underway — Best of 5 Series',
      '📡 Streaming LIVE on Twitch • YouTube • Facebook',
      '🔥 Join us next week for the grand prize ceremony'
    ]
  };

  // Broadcast tới toàn bộ các client kết nối để làm sạch giao diện tức thời
  broadcast({ type: 'init', data: state });

  // Lưu ngay trạng thái trống này xuống đĩa
  saveStateToDisk();
  console.log('[SYSTEM] State reset successfully upon login/logout.');
}

module.exports = {
  init,
  handleWSMessage,
  saveStateToDisk,
  resetState,
  STATE_SAVE_FILE
};
