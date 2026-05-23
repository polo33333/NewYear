const fs = require('fs');
const path = require('path');
const { states, createDefaultState } = require('./state');
const { broadcast } = require('./wsService');

const STATE_SAVE_FILE = path.join(__dirname, '../data/state_save.json');

/**
 * Khởi động logic tải lại trạng thái đã lưu & bộ mô phỏng chỉ số live stream
 */
function init() {
  // RAM-Only: Do not load persisted states from disk.
  console.log('[SYSTEM] RAM-Only state storage initialized.');

  // ── Simulate live stats khi đang stream cho toàn bộ room hoạt động ──
  setInterval(() => {
    for (const roomId in states) {
      const uState = states[roomId];
      if (!uState || !uState.isLive) continue;
      
      if (!uState.stats) {
        uState.stats = { viewers: 100, chatPerMin: 300, bitrate: 6000, fps: 60, cpu: 30, gpu: 60 };
      }
      
      uState.stats.viewers += Math.floor(Math.random() * 20 - 8);
      uState.stats.chatPerMin = Math.floor(300 + Math.random() * 100);
      uState.stats.bitrate = 5800 + Math.floor(Math.random() * 400);
      uState.stats.fps = Math.random() > 0.95 ? 59 : 60;
      uState.stats.cpu = Math.floor(28 + Math.random() * 10);
      uState.stats.gpu = Math.floor(55 + Math.random() * 15);
      
      if (!uState.score) {
        uState.score = {
          teamA: { name: 'Team A', logo: '🐉', color: '#00aaff', score: 0 },
          teamB: { name: 'Team B', logo: '👻', color: '#ff4444', score: 0 },
          matchTimer: 0
        };
      }
      uState.score.matchTimer = (uState.score.matchTimer || 0) + 1;
      
      broadcast({ type: 'stats', data: uState.stats }, roomId);
      broadcast({ type: 'score', data: uState.score }, roomId);
    }
  }, 2000);
}

/**
 * Tự động ghi trạng thái hiện tại của 1 room xuống file state_save.json
 */
function saveStateToDisk(roomId) {
  // RAM-Only: Do not save states to disk.
  return;
}

/**
 * Xử lý tin nhắn nhận được từ control panel qua WebSocket
 */
function handleWSMessage(msg, roomId) {
  if (!roomId) roomId = '1';
  if (!states[roomId]) {
    states[roomId] = createDefaultState();
  }
  const uState = states[roomId];
  
  let stateChanged = false;
  switch (msg.type) {
    case 'set_scene':
      uState.scene = msg.value;
      uState.overlays.scoreboard = (uState.scene === 'gameplay');
      broadcast({ type: 'scene', value: uState.scene, senderId: msg.senderId }, roomId);
      broadcast({ type: 'overlays', data: uState.overlays, senderId: msg.senderId }, roomId);
      stateChanged = true;
      break;

    case 'toggle_overlay':
      uState.overlays[msg.key] = !uState.overlays[msg.key];
      broadcast({ type: 'overlays', data: uState.overlays, senderId: msg.senderId }, roomId);
      stateChanged = true;
      break;

    case 'update_score':
      uState.score = { ...uState.score, ...msg.data };
      broadcast({ type: 'score', data: uState.score, senderId: msg.senderId }, roomId);
      stateChanged = true;
      break;

    case 'update_tournament':
      uState.tournament = { ...uState.tournament, ...msg.data };
      broadcast({ type: 'tournament', data: uState.tournament, senderId: msg.senderId }, roomId);
      stateChanged = true;
      break;

    case 'update_break':
      uState.break = { ...uState.break, ...msg.data };
      broadcast({ type: 'break', data: uState.break, senderId: msg.senderId }, roomId);
      stateChanged = true;
      break;

    case 'update_ticker':
      uState.ticker = { ...uState.ticker, ...msg.data };
      broadcast({ type: 'ticker', data: uState.ticker, senderId: msg.senderId }, roomId);
      stateChanged = true;
      break;

    case 'update_roster':
      if (msg.data) {
        for (let teamKey in msg.data) {
          if (!uState.rosters[teamKey]) {
            uState.rosters[teamKey] = {};
          }
          uState.rosters[teamKey] = {
            ...uState.rosters[teamKey],
            ...msg.data[teamKey]
          };
        }

        // Recalculate total scores based ONLY on officially synced rounds in uState.rosters
        let scoreA = 0;
        let scoreB = 0;
        const rosters = uState.rosters || {};
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

        if (!uState.score) {
          uState.score = {
            teamA: { name: 'Team A', logo: '🐉', color: '#00aaff', score: 0 },
            teamB: { name: 'Team B', logo: '👻', color: '#ff4444', score: 0 }
          };
        }
        if (!uState.score.teamA) uState.score.teamA = { score: 0 };
        if (!uState.score.teamB) uState.score.teamB = { score: 0 };

        uState.score.teamA.score = scoreA;
        uState.score.teamB.score = scoreB;

        broadcast({ type: 'score', data: uState.score, senderId: msg.senderId }, roomId);
      }
      broadcast({ type: 'rosters', data: uState.rosters, senderId: msg.senderId }, roomId);
      stateChanged = true;
      break;
  }

  if (stateChanged) {
    saveStateToDisk(roomId);
  }
}

/**
 * Đưa trạng thái về mặc định và dọn sạch dữ liệu roster/pick
 */
function resetState(roomId) {
  if (!roomId) roomId = '1';
  states[roomId] = createDefaultState();

  // Broadcast tới toàn bộ các client kết nối để làm sạch giao diện tức thời
  broadcast({ type: 'init', data: states[roomId] }, roomId);

  // Lưu ngay trạng thái trống này xuống đĩa
  saveStateToDisk(roomId);
  console.log(`[SYSTEM] State reset successfully for room ${roomId}.`);
}

module.exports = {
  init,
  handleWSMessage,
  saveStateToDisk,
  resetState,
  STATE_SAVE_FILE
};

