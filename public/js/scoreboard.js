const WS_PROTOCOL = location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTOCOL}//${location.host}/ws/overlay${location.search}`;
let ws, state = null;

function connect() {
  ws = new WebSocket(WS_URL);
  ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
  ws.onclose = () => setTimeout(connect, 2000);
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'init':
      state = msg.data;
      syncUI();
      break;
    case 'overlays':
      if (state) state.overlays = msg.data;
      updateScoreboardsVisibility();
      break;
    case 'score':
      if (state) state.score = msg.data;
      updateScore(msg.data);
      break;
    case 'rosters':
      if (state) {
        state.rosters = msg.data;
        updateNetPoints(msg.data);
      }
      break;
  }
}

function syncUI() {
  if (!state) return;
  updateScore(state.score);
  updateScoreboardsVisibility();
  if (state.rosters) {
    updateNetPoints(state.rosters);
  }
}

function animateNumber(obj, start, end, duration) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 4);
    obj.textContent = Math.floor(easeOut * (end - start) + start);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      obj.textContent = end;
    }
  };
  window.requestAnimationFrame(step);
}

function updateScore(score) {
  if (!score) return;
  const sa = parseInt(score.teamA.score) || 0;
  const sb = parseInt(score.teamB.score) || 0;
  
  const scoreAEl = document.getElementById('scoreA');
  const scoreBEl = document.getElementById('scoreB');
  if (scoreAEl) {
    const currA = parseInt(scoreAEl.textContent) || 0;
    if (currA !== sa) animateNumber(scoreAEl, currA, sa, 1000);
  }
  if (scoreBEl) {
    const currB = parseInt(scoreBEl.textContent) || 0;
    if (currB !== sb) animateNumber(scoreBEl, currB, sb, 1000);
  }

  const scoreA2El = document.getElementById('scoreA2');
  const scoreB2El = document.getElementById('scoreB2');
  if (scoreA2El) {
    const currA2 = parseInt(scoreA2El.textContent) || 0;
    if (currA2 !== sa) animateNumber(scoreA2El, currA2, sa, 1000);
  }
  if (scoreB2El) {
    const currB2 = parseInt(scoreB2El.textContent) || 0;
    if (currB2 !== sb) animateNumber(scoreB2El, currB2, sb, 1000);
  }

  const nameAEl = document.getElementById('nameA');
  const nameBEl = document.getElementById('nameB');
  if (nameAEl) nameAEl.textContent = score.teamA.name;
  if (nameBEl) nameBEl.textContent = score.teamB.name;

  const nameA2El = document.getElementById('nameA2');
  const nameB2El = document.getElementById('nameB2');
  if (nameA2El) nameA2El.textContent = score.teamA.name;
  if (nameB2El) nameB2El.textContent = score.teamB.name;

  const diffEl = document.getElementById('scoreDiff');
  if (diffEl) {
    const diff = Math.abs(sa - sb);
    diffEl.textContent = diff > 0 ? '+' + diff.toLocaleString() : '0';
  }

  const colorA = score.teamA.color || '#10b981';
  const colorB = score.teamB.color || '#ef4444';

  const scoreboard = document.getElementById('scoreboard');
  if (scoreboard) {
    scoreboard.style.setProperty('--color-left', colorA);
    scoreboard.style.setProperty('--color-right', colorB);
    scoreboard.style.setProperty('--color-left-faint', colorA + '26');
    scoreboard.style.setProperty('--color-right-faint', colorB + '26');
  }

  const scoreboard2 = document.getElementById('scoreboard2');
  if (scoreboard2) {
    scoreboard2.style.setProperty('--color-left', colorA);
    scoreboard2.style.setProperty('--color-right', colorB);
  }
}

function updateScoreboardsVisibility() {
  if (!state) return;
  const useStyle2 = state.overlays?.scoreboard2 === true;

  const sb1 = document.getElementById('scoreboard');
  const sb2 = document.getElementById('scoreboard2');

  if (sb1) sb1.classList.toggle('hidden', useStyle2);
  if (sb2) sb2.classList.toggle('hidden', !useStyle2);
}

function updateNetPoints(data) {
  if (!data) return;
  let netA = 0, netB = 0;
  if (data.teamA) {
    for (let r = 1; r <= 6; r++) {
      const rd = data.teamA['round' + r] || { points: 0, deduction: 0, buyPoints: 0 };
      netA += (rd.points || 0) - (rd.deduction || 0) - (rd.buyPoints || 0);
    }
  }
  if (data.teamB) {
    for (let r = 1; r <= 6; r++) {
      const rd = data.teamB['round' + r] || { points: 0, deduction: 0, buyPoints: 0 };
      netB += (rd.points || 0) - (rd.deduction || 0) - (rd.buyPoints || 0);
    }
  }

  const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  const diff = netA - netB;
  const netAEl = document.getElementById('netPointsA');
  const netBEl = document.getElementById('netPointsB');
  if (netAEl && netBEl) {
    netAEl.textContent = '';
    netBEl.textContent = '';
    if (diff > 0) {
      netAEl.textContent = `+${formatNumber(diff)}`;
    } else if (diff < 0) {
      netBEl.textContent = `+${formatNumber(Math.abs(diff))}`;
    }
  }
}

connect();
