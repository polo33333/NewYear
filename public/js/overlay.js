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

  if (document.getElementById('bmTeam1')) {
    document.getElementById('bmTeam1').style.setProperty('--color', colorA);
    document.getElementById('bmTeam1').style.setProperty('--color-rgb', hexToRgbString(colorA));
  }
  if (document.getElementById('bmTeam2')) {
    document.getElementById('bmTeam2').style.setProperty('--color', colorB);
    document.getElementById('bmTeam2').style.setProperty('--color-rgb', hexToRgbString(colorB));
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
    if (ptsEl) {
      const targetPts = (roundData.points || 0) - (roundData.deduction || 0) - (roundData.buyPoints || 0);
      const currPts = parseInt(ptsEl.textContent) || 0;
      if (currPts !== targetPts) animateNumber(ptsEl, currPts, targetPts, 1000);
    }

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

  let teamABlock = '', teamBBlock = '';
  let teamARows = '', teamBRows = '';

  let totalScores = { A: 0, B: 0 };
  ['A', 'B'].forEach(teamCode => {
    const teamData = data['team' + teamCode] || {};
    for (let r = 1; r <= 6; r++) {
      const rd = teamData['round' + r] || {};
      totalScores[teamCode] += (rd.points || 0) - (rd.deduction || 0) - (rd.buyPoints || 0);
    }
  });

  ['A', 'B'].forEach(teamCode => {
    const teamKey = 'team' + teamCode;
    const teamData = data[teamKey] || {};
    const teamName = state.score[teamKey].name || `TEAM ${teamCode}`;
    const teamColor = state.score[teamKey].color || (teamCode === 'A' ? '#ef4444' : '#0ea5e9');

    let totalScore = 0;
    let rowsHtml = '';

    for (let r = 1; r <= 6; r++) {
      const rd = teamData['round' + r] || { heroes: [], weapons: [], points: 0, deduction: 0, buyPoints: 0 };
      const p = rd.points || 0;
      const d = rd.deduction || 0;
      const buy = rd.buyPoints || 0;
      const net = p - d - buy;
      totalScore += net;
      let netClass = net > 0 ? 'pos' : (net < 0 ? 'neg' : 'zero');

      let heroesHtml = '<div class="stats-heroes">';
      for (let i = 0; i < 3; i++) {
        const h = rd.heroes?.[i];
        const hRc = rd.heroRcs?.[i] || '0';
        let hImg = h ? getCharImage(h) : '';
        let hStyle = hImg ? `background-image:url('${hImg}');` : '';
        let innerH = !hImg && h ? h.substring(0, 2).toUpperCase() : (h ? '' : '<i class="fas fa-user"></i>');
        heroesHtml += `
          <div class="stats-icon-col">
            <div class="stats-icon-sq" style="${hStyle}">${innerH}</div>
            ${h ? `<div class="stats-lbl-rc">RC${hRc}</div>` : ''}
          </div>
        `;
      }
      heroesHtml += '</div>';

      let weaponsHtml = '<div class="stats-weapons">';
      for (let i = 0; i < 3; i++) {
        const w = rd.weapons?.[i];
        const wR = rd.weaponRs?.[i] || '1';
        let wImg = w ? getWeaponImage(w) : '';
        let wStyle = wImg ? `background-image:url('${wImg}');` : '';
        let innerW = !wImg && w ? 'W' : (w ? '' : '<i class="fas fa-gavel"></i>');
        weaponsHtml += `
          <div class="stats-icon-col">
            <div class="stats-icon-sq" style="${wStyle}">${innerW}</div>
            ${w ? `<div class="stats-lbl-r">R${wR}</div>` : ''}
          </div>
        `;
      }
      weaponsHtml += '</div>';

      rowsHtml += `
        <div class="stats-row">
          <div class="stats-round-num">${r}</div>
          ${heroesHtml}
          ${weaponsHtml}
          <div class="stats-val pt-val">${p > 0 ? '+' + p : p}</div>
          <div class="stats-val dt-val">${d > 0 ? '-' + d : d}</div>
          <div class="stats-val buy-val">${buy > 0 ? '-' + buy : buy}</div>
          <div class="stats-val net ${netClass}">${net > 0 ? '+' + net : net}</div>
        </div>
      `;
    }

    let resultText = '';
    let resultClass = '';
    if (totalScores.A > totalScores.B) {
      resultText = teamCode === 'A' ? 'VICTORY' : 'DEFEAT';
      resultClass = teamCode === 'A' ? 'win' : 'lose';
    } else if (totalScores.B > totalScores.A) {
      resultText = teamCode === 'B' ? 'VICTORY' : 'DEFEAT';
      resultClass = teamCode === 'B' ? 'win' : 'lose';
    } else {
      resultText = 'DRAW';
      resultClass = 'draw';
    }

    const blockHtml = `
      <div class="stats-team-block team${teamCode}" style="--color:${teamColor}; --color-rgb:${hexToRgbString(teamColor)}">
        <div class="stats-team-result ${resultClass}">${resultText}</div>
        <div class="stats-team-label">${teamName}</div>
        <div class="stats-team-score-big">${totalScore}</div>
      </div>
    `;

    if (teamCode === 'A') {
      teamABlock = blockHtml;
      teamARows = `<div class="stats-team-group teamA" style="--color:${teamColor}">${rowsHtml}</div>`;
    } else {
      teamBBlock = blockHtml;
      teamBRows = `<div class="stats-team-group teamB" style="--color:${teamColor}">${rowsHtml}</div>`;
    }
  });

  statsContainer.innerHTML = `
    <div class="stats-left-panel">
      <div class="stats-header-title">MATCH STATISTICS</div>
      ${teamABlock}
      ${teamBBlock}
    </div>
    <div class="stats-right-panel">
      <div class="stats-header-row">
        <div class="stats-col-headers">
          <div class="stats-col-header"></div> <!-- empty space for round num -->
          <div class="stats-col-header wide">RESONATOR</div>
          <div class="stats-col-header wide">WEAPONS</div>
          <div class="stats-col-header">PTS</div>
          <div class="stats-col-header">DED</div>
          <div class="stats-col-header">BUY</div>
          <div class="stats-col-header">NET</div>
        </div>
      </div>
      <div class="stats-table-body">
        ${teamARows}
        ${teamBRows}
      </div>
    </div>
  `;
}

function hexToRgbString(hex) {
  let c;
  if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
    c= hex.substring(1).split('');
    if(c.length== 3){
      c= [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c= '0x'+c.join('');
    return [(c>>16)&255, (c>>8)&255, c&255].join(',');
  }
  return '255,255,255';
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
  if (breakAnimFrame) {
    cancelAnimationFrame(breakAnimFrame);
    breakAnimFrame = null;
  }
  if (bracketAnimFrame) {
    cancelAnimationFrame(bracketAnimFrame);
    bracketAnimFrame = null;
  }
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

  if (scene === 'bracket' && bracket) {
    bracket.classList.add('visible');
  }
  if (scene === 'stats' && stats) stats.classList.add('visible');
  if (scene === 'break' && brk) {
    brk.classList.add('visible');
    breakSeconds = state.break.duration; updateBreakTimer();
    breakInterval = setInterval(() => { breakSeconds = Math.max(0, breakSeconds - 1); updateBreakTimer(); }, 1000);
  }
}

function updateBreakTimer() {
  const m = String(Math.floor(breakSeconds / 60)).padStart(2, '0');
  const s = String(breakSeconds % 60).padStart(2, '0');
  const bt = document.getElementById('breakTimer');
  if (bt) bt.textContent = `${m}:${s}`;
}

// ── 3D Octahedron Wireframe Renderer for Break Scene ──
let breakCanvas = null;
let breakCtx = null;
let breakAnimFrame = null;
let rotX = 0.5;
let rotY = 0.5;

const octahedronVertices = [
  { x: 0, y: -2.2, z: 0 },  // Top
  { x: 0, y: 2.2, z: 0 },   // Bottom
  { x: 2.6, y: 0, z: 0 },   // Right
  { x: -2.6, y: 0, z: 0 },  // Left
  { x: 0, y: 0, z: 2.2 },   // Front
  { x: 0, y: 0, z: -2.2 }   // Back
];

const octahedronEdges = [
  [0, 2], [0, 3], [0, 4], [0, 5],
  [1, 2], [1, 3], [1, 4], [1, 5],
  [2, 4], [4, 3], [3, 5], [5, 2]
];

function initBreakCanvas() {
  breakCanvas = document.getElementById('breakCanvas');
  if (!breakCanvas) return;
  breakCtx = breakCanvas.getContext('2d');
  
  // Set resolution based on device pixel ratio
  const dpr = window.devicePixelRatio || 1;
  breakCanvas.width = 600 * dpr;
  breakCanvas.height = 600 * dpr;
  breakCtx.scale(dpr, dpr);
}

function renderBreakScene() {
  if (!breakCanvas || !breakCtx) return;
  
  const width = 600;
  const height = 600;
  breakCtx.clearRect(0, 0, width, height);
  
  // Rotate angles slowly
  rotX += 0.004;
  rotY += 0.007;
  
  // Project vertices
  const projected = [];
  const cx = width / 2;
  const cy = height / 2;
  const fov = 350;
  const cameraDist = 4.0;
  
  octahedronVertices.forEach(v => {
    // Rotate Y
    let x1 = v.x * Math.cos(rotY) - v.z * Math.sin(rotY);
    let z1 = v.x * Math.sin(rotY) + v.z * Math.cos(rotY);
    
    // Rotate X
    let y2 = v.y * Math.cos(rotX) - z1 * Math.sin(rotX);
    let z2 = v.y * Math.sin(rotX) + z1 * Math.cos(rotX);
    
    // Perspective projection
    const scaleFactor = fov / (cameraDist + z2);
    projected.push({
      x: cx + x1 * scaleFactor,
      y: cy + y2 * scaleFactor,
      z: z2
    });
  });
  
  // Reset shadow attributes for lines
  breakCtx.shadowColor = '#00f5ff';
  
  // Draw edges
  octahedronEdges.forEach(edge => {
    const p1 = projected[edge[0]];
    const p2 = projected[edge[1]];
    
    // Average depth for opacity sorting/fading of background lines
    const avgZ = (p1.z + p2.z) / 2;
    const alpha = Math.max(0.15, Math.min(0.65, 0.5 - avgZ * 0.2));
    
    breakCtx.beginPath();
    breakCtx.moveTo(p1.x, p1.y);
    breakCtx.lineTo(p2.x, p2.y);
    breakCtx.strokeStyle = `rgba(0, 245, 255, ${alpha})`;
    breakCtx.lineWidth = 1.2;
    breakCtx.shadowBlur = 6;
    breakCtx.stroke();
  });
  
  // Draw vertices (glowing points)
  projected.forEach(p => {
    const size = 3;
    const alpha = Math.max(0.2, Math.min(1.0, 0.7 - p.z * 0.2));
    
    // Draw white center dot
    breakCtx.beginPath();
    breakCtx.arc(p.x, p.y, size, 0, Math.PI * 2);
    breakCtx.fillStyle = '#ffffff';
    breakCtx.shadowBlur = 10;
    breakCtx.shadowColor = '#00f5ff';
    breakCtx.fill();
    
    // Draw outer cyan ring
    breakCtx.beginPath();
    breakCtx.arc(p.x, p.y, size * 2.5, 0, Math.PI * 2);
    breakCtx.strokeStyle = `rgba(0, 245, 255, ${alpha})`;
    breakCtx.lineWidth = 1;
    breakCtx.shadowBlur = 0; // turn off shadow for outer ring to keep it clean
    breakCtx.stroke();
  });
  
  if (state && state.scene === 'break') {
    breakAnimFrame = requestAnimationFrame(renderBreakScene);
  }
}

// ── 3D Octahedron Wireframe Renderer for Bracket Scene ──
let bracketCanvas = null;
let bracketCtx = null;
let bracketAnimFrame = null;
let bracketRotX = 0.5;
let bracketRotY = 0.5;

function initBracketCanvas() {
  bracketCanvas = document.getElementById('bracketCanvas');
  if (!bracketCanvas) return;
  bracketCtx = bracketCanvas.getContext('2d');
  
  const dpr = window.devicePixelRatio || 1;
  bracketCanvas.width = 600 * dpr;
  bracketCanvas.height = 600 * dpr;
  bracketCtx.scale(dpr, dpr);
}

function renderBracketScene() {
  if (!bracketCanvas || !bracketCtx) return;
  
  const width = 600;
  const height = 600;
  bracketCtx.clearRect(0, 0, width, height);
  
  bracketRotX += 0.003;
  bracketRotY += 0.005;
  
  const projected = [];
  const cx = width / 2;
  const cy = height / 2;
  const fov = 350;
  const cameraDist = 4.0;
  
  octahedronVertices.forEach(v => {
    let x1 = v.x * Math.cos(bracketRotY) - v.z * Math.sin(bracketRotY);
    let z1 = v.x * Math.sin(bracketRotY) + v.z * Math.cos(bracketRotY);
    
    let y2 = v.y * Math.cos(bracketRotX) - z1 * Math.sin(bracketRotX);
    let z2 = v.y * Math.sin(bracketRotX) + z1 * Math.cos(bracketRotX);
    
    const scaleFactor = fov / (cameraDist + z2);
    projected.push({
      x: cx + x1 * scaleFactor,
      y: cy + y2 * scaleFactor,
      z: z2
    });
  });
  
  bracketCtx.shadowColor = '#00f5ff';
  
  octahedronEdges.forEach(edge => {
    const p1 = projected[edge[0]];
    const p2 = projected[edge[1]];
    const avgZ = (p1.z + p2.z) / 2;
    const alpha = Math.max(0.12, Math.min(0.55, 0.4 - avgZ * 0.15));
    
    bracketCtx.beginPath();
    bracketCtx.moveTo(p1.x, p1.y);
    bracketCtx.lineTo(p2.x, p2.y);
    bracketCtx.strokeStyle = `rgba(0, 245, 255, ${alpha})`;
    bracketCtx.lineWidth = 1.0;
    bracketCtx.shadowBlur = 5;
    bracketCtx.stroke();
  });
  
  projected.forEach(p => {
    const size = 2.5;
    const alpha = Math.max(0.2, Math.min(0.9, 0.6 - p.z * 0.15));
    
    bracketCtx.beginPath();
    bracketCtx.arc(p.x, p.y, size, 0, Math.PI * 2);
    bracketCtx.fillStyle = '#ffffff';
    bracketCtx.shadowBlur = 8;
    bracketCtx.shadowColor = '#00f5ff';
    bracketCtx.fill();
    
    bracketCtx.beginPath();
    bracketCtx.arc(p.x, p.y, size * 2.5, 0, Math.PI * 2);
    bracketCtx.strokeStyle = `rgba(0, 245, 255, ${alpha})`;
    bracketCtx.lineWidth = 0.8;
    bracketCtx.shadowBlur = 0;
    bracketCtx.stroke();
  });
  
  if (state && state.scene === 'bracket') {
    bracketAnimFrame = requestAnimationFrame(renderBracketScene);
  }
}

connect();
