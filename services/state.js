// ── State toàn bộ app ──
const fs = require('fs');
const path = require('path');
const db = require('./db');

const states = {};

function createDefaultState() {
  return {
    isLive: false,
    scene: 'end',         // gameplay | bracket | stats | break | end
    overlays: {
      scoreboard: true,
      ticker: false,
      rosterA: false,
      rosterB: false,
      show_song: false
    },
    song: { name: '', isPlaying: false },
    rosters: {
      teamA: {},
      teamB: {},
    },

    score: {
      teamA: { name: 'Team A', logo: '', color: '#00aaff', score: 0 },
      teamB: { name: 'Team B', logo: '', color: '#ff4444', score: 0 },
      matchTimer: 0
    },
    tournament: {
      name: 'MATRIX CUP 2026',
      game: 'Wuthering Waves',
      format: 'Double Elimination',
      bracketLabel: 'GRAND FINALS — MATRIX CUP 2026',
    },
    break: {
      duration: 300, // seconds
    },
    ticker: {
      items: [
        '🏆 Grand Finals — Team A vs Team B',
        '🎮 Game 3 Underway — Best of 5 Series',
        '📡 Streaming LIVE on Twitch • YouTube • Facebook',
        '🔥 Join us next week for the grand prize ceremony',
      ]
    }
  };
}

function getRoomId(userId, token, queryRoomId) {
  if (!userId) return '1';
  try {
    const row = db.prepare('SELECT isSync FROM users WHERE id = ?').get(String(userId));
    if (row && row.isSync === 1) {
      return `room_${userId}`;
    }
  } catch (err) {
    console.error('[STATE] Error reading users for roomId:', err.message);
  }

  // isSync === false or not configured (independent devices):
  if (queryRoomId && queryRoomId.trim()) {
    return queryRoomId.trim();
  }

  // Generate a random room ID if none was provided
  return 'room_' + Math.random().toString(36).substring(2, 10);
}

module.exports = {
  states,
  createDefaultState,
  getRoomId
};

