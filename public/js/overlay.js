const WS_PROTOCOL = location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTOCOL}//${location.host}/ws/overlay${location.search}`;
let ws, state = null;
let breakSeconds = 0, breakInterval = null;

let allCharacters = [];
let allWeapons = [];

Promise.all([
  fetch('/api/characters').then(r => r.json()).then(data => allCharacters = data),
  fetch('/api/weapons').then(r => r.json()).then(data => allWeapons = data)
]).then(() => {
  if (state && state.rosters) updateStatsScene(state.rosters);
}).catch(console.error);

function connect() {
  ws = new WebSocket(WS_URL);
  ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
  ws.onclose = () => setTimeout(connect, 2000);
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'init': state = msg.data; syncUI(); switchScene(state.scene, true); break;
    case 'scene': if (state) state.scene = msg.value; switchScene(msg.value); break;
    case 'overlays': if (state) state.overlays = msg.data; updateOverlays(msg.data); break;
    case 'score': if (state) state.score = msg.data; updateScore(msg.data); updateRosters(state.rosters); break;
    case 'ticker': if (state) state.ticker = msg.data; updateTicker(msg.data); break;
    case 'rosters': if (state) state.rosters = msg.data; updateRosters(msg.data); break;
    case 'tournament': if (state) state.tournament = msg.data; if (document.getElementById('bracketLabel')) document.getElementById('bracketLabel').textContent = state.tournament.bracketLabel; break;
    case 'break': if (state) state.break = msg.data; if (state.scene === 'break') { breakSeconds = state.break.duration; updateBreakTimer(); } break;
  }
}

function syncUI() {
  if (!state) return;
  updateScore(state.score);
  updateOverlays(state.overlays);
  updateTicker(state.ticker);
  updateRosters(state.rosters);
  if (state.tournament && document.getElementById('bracketLabel')) document.getElementById('bracketLabel').textContent = state.tournament.bracketLabel;
}

function updateScore(score) {
  const sa = score.teamA.score, sb = score.teamB.score;
  const scoreAEl = document.getElementById('scoreA');
  const scoreBEl = document.getElementById('scoreB');
  if (scoreAEl) scoreAEl.textContent = sa;
  if (scoreBEl) scoreBEl.textContent = sb;

  const nameAEl = document.getElementById('nameA');
  const nameBEl = document.getElementById('nameB');
  if (nameAEl) nameAEl.textContent = score.teamA.name;
  if (nameBEl) nameBEl.textContent = score.teamB.name;

  if (document.getElementById('bName1')) document.getElementById('bName1').textContent = score.teamA.name;
  if (document.getElementById('bName2')) document.getElementById('bName2').textContent = score.teamB.name;

  const colorA = score.teamA.color || '#10b981';
  const colorB = score.teamB.color || '#ef4444';

  const scoreboard = document.getElementById('scoreboard');
  if (scoreboard) {
    scoreboard.style.setProperty('--color-left', colorA);
    scoreboard.style.setProperty('--color-right', colorB);
    scoreboard.style.setProperty('--color-left-faint', colorA + '26'); // 15% opacity hex
    scoreboard.style.setProperty('--color-right-faint', colorB + '26'); // 15% opacity hex
  }

  if (document.getElementById('bName1')) document.getElementById('bName1').style.setProperty('--color', colorA);
  if (document.getElementById('bName2')) document.getElementById('bName2').style.setProperty('--color', colorB);
}

function updateOverlays(overlays) {
  if (!overlays) return;
  const toggle = (id, v) => document.getElementById(id)?.classList.toggle('hidden', !v);
  toggle('scoreboard', overlays.scoreboard !== false);
  toggle('ticker', overlays.ticker !== false);
  toggle('roster-left', overlays.rosterA === true);
  toggle('roster-right', overlays.rosterB === true);
}

function updateRosters(data) {
  if (!data || !state.score) return;

  // Extract round number from "ROUND X"
  let roundNum = 1;
  if (state.score.round) {
    const match = state.score.round.match(/\d+/);
    if (match) roundNum = parseInt(match[0]);
  }
  const roundKey = 'round' + roundNum;

  const render = (teamCode) => {
    const teamKey = 'team' + teamCode;
    const teamData = data[teamKey] || {};
    const roundData = teamData[roundKey] || { heroes: [], weapons: [], points: 0, deduction: 0, buyPoints: 0 };

    // Update points
    const ptsEl = document.getElementById('rosterPoints' + teamCode);
    if (ptsEl) ptsEl.textContent = (roundData.points || 0) - (roundData.deduction || 0) - (roundData.buyPoints || 0);

    // Update heroes/weapons list
    const listEl = document.getElementById('heroList' + teamCode);
    if (listEl) {
      const heroes = roundData.heroes || [];
      const weapons = roundData.weapons || [];

      listEl.innerHTML = heroes.map((h, i) => {
        const weapon = weapons[i] ? `<div class="weapon-tag">${weapons[i]}</div>` : '';
        return `
            <div class="hero-item">
              <div class="hero-icon">${i + 1}</div>
              <div class="hero-info">
                <span class="hero-name">${h || '—'}</span>
                ${weapon}
              </div>
            </div>
          `;
      }).join('');
    }
  };

  render('A');
  render('B');

  const rna = document.getElementById('rosterNameA');
  const rnb = document.getElementById('rosterNameB');
  if (rna) {
    rna.textContent = state.score.teamA.name;
  }
  if (rnb) {
    rnb.textContent = state.score.teamB.name;
  }

  // ── Calculate Scoreboard Net Points ──
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

  // Set widths based on comparison (tied = both 100%, otherwise leading is 100% and trailing is proportional)
  const fillA = document.getElementById('progressFillA');
  const fillB = document.getElementById('progressFillB');
  if (fillA && fillB) {
    if (netA === netB) {
      fillA.style.width = '100%';
      fillB.style.width = '100%';
    } else if (netA > netB) {
      fillA.style.width = '100%';
      fillB.style.width = netA === 0 ? '0%' : `${(netB / netA) * 100}%`;
    } else {
      fillB.style.width = '100%';
      fillA.style.width = netB === 0 ? '0%' : `${(netA / netB) * 100}%`;
    }
  }

  // Calculate and update point difference inside the transparent containers
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

  updateStatsScene(data);
}

function getCharImage(name) {
  const c = allCharacters.find(x => x.name === name);
  return c ? (c.icon || c.image).replace(/^\/?icon\//, 'images/icon/') : '';
}
function getWeaponImage(name) {
  const w = allWeapons.find(x => x.name === name);
  return w ? (w.imagebig || w.image).replace(/^\/?images\/weapons?\//, 'images/weapon/') : '';
}

function updateStatsScene(data) {
  const statsContainer = document.getElementById('statsContainer');
  if (!statsContainer || !state.score) return;
  let html = '';
  ['A', 'B'].forEach(teamCode => {
    const teamKey = 'team' + teamCode;
    const teamData = data[teamKey] || {};
    const teamName = state.score[teamKey].name;
    const teamColor = state.score[teamKey].color || (teamCode === 'A' ? '#00aaff' : '#ff4444');

    let totalScore = 0;

    html += `<div class="stats-team-col">`;
    const headerContent = teamCode === 'A'
      ? `<span>${teamName}</span><span class="stats-total-score" id="statsTotal${teamCode}">0</span>`
      : `<span class="stats-total-score" id="statsTotal${teamCode}">0</span><span>${teamName}</span>`;
    html += `<div class="stats-team-header team${teamCode}" style="--color:${teamColor}">${headerContent}</div>`;

    for (let r = 1; r <= 6; r++) {
      const rd = teamData['round' + r] || { heroes: [], weapons: [], points: 0, deduction: 0, buyPoints: 0 };
      const p = rd.points || 0;
      const d = rd.deduction || 0;
      const buy = rd.buyPoints || 0;
      const net = p - d - buy;
      totalScore += net;
      let netClass = net > 0 ? 'pos' : (net < 0 ? 'neg' : 'zero');

      let heroesHtml = '<div class="stats-heroes-group">';
      for (let i = 0; i < 3; i++) {
        const h = rd.heroes?.[i];
        const hRc = rd.heroRcs?.[i] || '0';
        let hImg = h ? getCharImage(h) : '';
        let hStyle = hImg ? `background-image:url('${hImg}');` : '';
        let innerH = !hImg && h ? h.substring(0, 2).toUpperCase() : (h ? '' : '<i class="fas fa-user" style="font-size: 20px;opacity:0.4;"></i>');
        heroesHtml += `
            <div class="stats-box-col">
              <div class="stats-hero-sq" style="${hStyle}">${innerH}</div>
              <div class="stats-lbl-rc">RC${hRc}</div>
            </div>
        `;
      }
      heroesHtml += '</div><div class="stats-divider"></div><div class="stats-weapons-group">';

      for (let i = 0; i < 3; i++) {
        const w = rd.weapons?.[i];
        const wR = rd.weaponRs?.[i] || '1';
        let wImg = w ? getWeaponImage(w) : '';
        let wStyle = wImg ? `background-image:url('${wImg}');` : '';
        let innerW = !wImg && w ? 'W' : (w ? '' : '<i class="fas fa-gavel" style="font-size: 20px;opacity:0.4;"></i>');
        heroesHtml += `
            <div class="stats-box-col">
              <div class="stats-weapon-sq" style="${wStyle}">${innerW}</div>
              <div class="stats-lbl-r">R${wR}</div>
            </div>
        `;
      }
      heroesHtml += '</div>';
      html += `
        <div class="stats-round-row">
          <div class="stats-round-label">R${r}</div>
          <div class="stats-heroes">${heroesHtml}</div>
          <div class="stats-flex-1"></div>
          <div class="stats-scores-grid">
            <div class="stats-score-item">
              <span class="stats-score-hdr">PT</span>
              <span class="stats-score-val pt-val">+${p}</span>
            </div>
            <div class="stats-score-item">
              <span class="stats-score-hdr">DT</span>
              <span class="stats-score-val dt-val">&minus;${d}</span>
            </div>
            <div class="stats-score-item">
              <span class="stats-score-hdr buy-hdr">BUY</span>
              <span class="stats-score-val buy-val">${buy > 0 ? `&minus;${buy}` : '0'}</span>
            </div>
            <div class="stats-score-item">
              <span class="stats-score-hdr">NET</span>
              <span class="stats-score-val net-val ${netClass}">${net}</span>
            </div>
          </div>
        </div>
      `;
    }

    html += `</div>`;
    html = html.replace(`id="statsTotal${teamCode}">0<`, `id="statsTotal${teamCode}">${totalScore}<`);
  });

  statsContainer.innerHTML = html;
}

function updateTicker(ticker) {
  if (!ticker || !ticker.items) return;
  const html = [...ticker.items, ...ticker.items].map(item => `<span style="margin-right:60px">${item}</span><span class="ticker-sep">◆</span>`).join('');
  const ti = document.getElementById('tickerInner');
  if (ti) ti.innerHTML = html;
}

function switchScene(scene, instant = false) {
  if (!state) return;
  state.scene = scene;
  syncUI();
  if (!instant) { const o = document.getElementById('scene-overlay'); if (o) o.classList.add('flash'); setTimeout(() => { if (o) o.classList.remove('flash'); }, 300); }

  const bracket = document.getElementById('bracket-scene');
  const brk = document.getElementById('break-scene');
  const stats = document.getElementById('stats-scene');
  if (bracket) bracket.classList.remove('visible');
  if (brk) brk.classList.remove('visible');
  if (stats) stats.classList.remove('visible');

  clearInterval(breakInterval);
  const showScore = scene === 'gameplay';
  const sb = document.getElementById('scoreboard');
  if (sb) sb.classList.toggle('hidden', !showScore || !(state.overlays.scoreboard));

  // Update background transparency
  document.body.style.transition = 'background 0.5s ease';
  if (scene === 'end') {
    document.body.style.background = 'rgba(255, 0, 0, 1)'; // Solid red background for End scene
  } else {
    const needsBg = ['bracket', 'break', 'stats'].includes(scene);
    document.body.style.background = needsBg ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0)';
  }

  if (scene === 'bracket' && bracket) bracket.classList.add('visible');
  if (scene === 'stats' && stats) stats.classList.add('visible');
  if (scene === 'break' && brk) {
    brk.classList.add('visible');
    breakSeconds = state.break.duration; updateBreakTimer();
    breakInterval = setInterval(() => { breakSeconds = Math.max(0, breakSeconds - 1); updateBreakTimer(); }, 1000);
  }
}

function updateBreakTimer() {
  const m = Math.floor(breakSeconds / 60), s = String(breakSeconds % 60).padStart(2, '0');
  const bt = document.getElementById('breakTimer');
  if (bt) bt.textContent = `${m}:${s}`;
}

connect();
