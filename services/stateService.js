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
 * Xử lý tin nhắn nhận được từ control panel qua WebSocket
 */
function handleWSMessage(msg) {
  switch (msg.type) {
    case 'set_scene':
      state.scene = msg.value;
      broadcast({ type: 'scene', value: state.scene });
      break;

    case 'toggle_overlay':
      state.overlays[msg.key] = !state.overlays[msg.key];
      broadcast({ type: 'overlays', data: state.overlays });
      break;

    case 'update_score':
      state.score = { ...state.score, ...msg.data };
      broadcast({ type: 'score', data: state.score });
      break;

    case 'update_tournament':
      state.tournament = { ...state.tournament, ...msg.data };
      broadcast({ type: 'tournament', data: state.tournament });
      break;

    case 'update_break':
      state.break = { ...state.break, ...msg.data };
      broadcast({ type: 'break', data: state.break });
      break;

    case 'update_ticker':
      state.ticker = { ...state.ticker, ...msg.data };
      broadcast({ type: 'ticker', data: state.ticker });
      break;

    case 'update_roster':
      state.rosters = { ...state.rosters, ...msg.data };
      broadcast({ type: 'rosters', data: state.rosters });
      break;
  }
}

module.exports = {
  init,
  handleWSMessage,
  STATE_SAVE_FILE
};
