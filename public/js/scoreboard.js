const WS_URL = `ws://${location.host}/ws/overlay`;
let ws, state = null;

function connect() {
  ws = new WebSocket(WS_URL);
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'init') {
      state = msg.data;
      updateScore(state.score);
      toggle(state.overlays.scoreboard);
    } else if (msg.type === 'score') {
      if (state) state.score = msg.data;
      updateScore(msg.data);
    } else if (msg.type === 'overlays') {
      if (state) state.overlays = msg.data;
      toggle(msg.data.scoreboard);
    } else if (msg.type === 'scene') {
      const showScore = ['gameplay', 'stats'].includes(msg.value);
      toggle(showScore && (state?.overlays?.scoreboard !== false));
    }
  };
  ws.onclose = () => setTimeout(connect, 2000);
}

function updateScore(score) {
  const sa = score.teamA.score, sb = score.teamB.score;
  document.getElementById('scoreA').textContent = sa;
  document.getElementById('scoreB').textContent = sb;
  document.getElementById('nameA').textContent = score.teamA.name;
  document.getElementById('nameB').textContent = score.teamB.name;
  
  const colorA = score.teamA.color || '#00aaff';
  const colorB = score.teamB.color || '#ff4444';

  document.getElementById('teamA').style.setProperty('--color', colorA);
  document.getElementById('teamB').style.setProperty('--color', colorB);
  document.getElementById('scoreA').style.color = colorA;
  document.getElementById('scoreB').style.color = colorB;

  const diff = sa - sb, da = document.getElementById('scoreDiffA'), db = document.getElementById('scoreDiffB');
  da.textContent = ''; db.textContent = '';
  da.style.backgroundColor = 'transparent'; db.style.backgroundColor = 'transparent';
  if (diff > 0) { 
    da.textContent = `+${diff}`; 
    da.style.backgroundColor = colorA;
    da.style.color = '#ffffff';
  }
  else if (diff < 0) { 
    db.textContent = `+${Math.abs(diff)}`; 
    db.style.backgroundColor = colorB;
    db.style.color = '#ffffff';
  }

  const t = score.matchTimer;
  const m = Math.floor(t / 60), s = String(t % 60).padStart(2, '0');
  document.getElementById('matchTimer').textContent = `${m}:${s}`;
}

function toggle(visible) {
  document.getElementById('scoreboard').classList.toggle('hidden', !visible);
}

connect();
