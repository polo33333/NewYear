// ── State toàn bộ app ──
const states = {};

function createDefaultState() {
  return {
    isLive: false,
    scene: 'gameplay',         // gameplay | bracket | stats | break | end
    overlays: {
      scoreboard: true,
      ticker: false,
      rosterA: false,
      rosterB: false,
    },
    rosters: {
      teamA: {},
      teamB: {},
    },
    score: {
      teamA: { name: 'Team A', logo: '🐉', color: '#00aaff', score: 0 },
      teamB: { name: 'Team B', logo: '👻', color: '#ff4444', score: 0 },
      matchTimer: 0
    },
    stats: {
      viewers: 100,
      chatPerMin: 300,
      bitrate: 6000,
      fps: 60,
      cpu: 30,
      gpu: 60
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

module.exports = {
  states,
  createDefaultState
};

