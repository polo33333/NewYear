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
    case 'tournament': if (state) state.tournament = msg.data; if (document.getElementById('bracketLabel')) document.getElementById('bracketLabel').textContent = state.tournament.bracketLabel; if (document.getElementById('bracketSubtitle')) document.getElementById('bracketSubtitle').textContent = state.tournament.bracketSubtitle || ''; break;
    case 'break': if (state) state.break = msg.data; if (state.scene === 'break') { breakSeconds = (state.break && typeof state.break.duration === 'number') ? state.break.duration : 300; updateBreakTimer(); } break;
    case 'song': if (state) state.song = msg.data; updateSongDisplay(state.song); break;
  }
}

function syncUI() {
  if (!state) return;
  updateScore(state.score);
  updateOverlays(state.overlays);
  updateTicker(state.ticker);
  updateRosters(state.rosters);
  updateSongDisplay(state.song);
  if (state.tournament && document.getElementById('bracketLabel')) document.getElementById('bracketLabel').textContent = state.tournament.bracketLabel;
  if (state.tournament && document.getElementById('bracketSubtitle')) document.getElementById('bracketSubtitle').textContent = state.tournament.bracketSubtitle || '';
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

  const scoreboard2 = document.getElementById('scoreboard2');
  if (scoreboard2) {
    scoreboard2.style.setProperty('--color-left', colorA);
    scoreboard2.style.setProperty('--color-right', colorB);
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

function updateScoreboardsVisibility() {
  if (!state) return;
  const showScore = state.overlays?.scoreboard !== false;
  const useStyle2 = state.overlays?.scoreboard2 === true;

  const sb1 = document.getElementById('scoreboard');
  const sb2 = document.getElementById('scoreboard2');

  if (sb1) sb1.classList.toggle('hidden', !showScore || useStyle2);
  if (sb2) sb2.classList.toggle('hidden', !showScore || !useStyle2);
}

function updateOverlays(overlays) {
  if (!overlays) return;
  const toggle = (id, v) => document.getElementById(id)?.classList.toggle('hidden', !v);
  updateScoreboardsVisibility();
  toggle('ticker', overlays.ticker !== false);
  toggle('roster-left', overlays.rosterA === true);
  toggle('roster-right', overlays.rosterB === true);

  if (state && state.song) {
    updateSongDisplay(state.song);
  }
}

function updateSongDisplay(song) {
  if (!song) return;
  const nameEl = document.getElementById('overlay-song-name');
  if (nameEl) {
    nameEl.textContent = song.name;
    nameEl.classList.remove('scrolling');
    requestAnimationFrame(() => {
      const container = nameEl.parentElement;
      if (nameEl.scrollWidth > container.clientWidth) {
        nameEl.classList.add('scrolling');
      }
    });
  }

  const toggle = (id, v) => document.getElementById(id)?.classList.toggle('hidden', !v);
  toggle('song-overlay', state.overlays?.show_song === true && song.isPlaying === true);
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
  let allRoundsCompleted = true;
  ['A', 'B'].forEach(teamCode => {
    const teamData = data['team' + teamCode] || {};
    for (let r = 1; r <= 6; r++) {
      const rd = teamData['round' + r] || {};
      totalScores[teamCode] += (rd.points || 0) - (rd.deduction || 0) - (rd.buyPoints || 0);

      const hasHero = rd.heroes && rd.heroes.some(h => h && h.trim() !== '');
      const hasScore = rd.points !== 0 && rd.points !== undefined && rd.points !== null;
      if (!hasHero && !hasScore) {
        allRoundsCompleted = false;
      }
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
    if (allRoundsCompleted) {
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
    }

    const watermarkVal = teamCode === 'A' ? '01' : '02';
    const blockHtml = `
      <div class="stats-team-block team${teamCode}" style="--color:${teamColor}; --color-rgb:${hexToRgbString(teamColor)}">
        <div class="stats-team-watermark">${watermarkVal}</div>
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
      <div class="stats-header-title" style="visibility: hidden;">MATCH STATISTICS</div>
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
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('');
    if (c.length == 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    return [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',');
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

  const brk = document.getElementById('break-scene');
  const stats = document.getElementById('stats-scene');
  if (brk) brk.classList.remove('visible');
  if (stats) stats.classList.remove('visible');

  clearInterval(breakInterval);
  updateScoreboardsVisibility();

  // Update background transparency
  document.body.style.transition = 'background 0.5s ease';
  if (scene === 'end') {
    document.body.style.background = 'rgba(255, 0, 0, 1)'; // Solid red background for End scene
  } else {
    const needsBg = ['break', 'stats'].includes(scene);
    document.body.style.background = needsBg ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0)';
  }


  if (scene === 'stats' && stats) stats.classList.add('visible');
  if (scene === 'break' && brk) {
    brk.classList.add('visible');
    breakSeconds = (state && state.break && typeof state.break.duration === 'number') ? state.break.duration : 300; 
    updateBreakTimer();
    breakInterval = setInterval(() => { 
      breakSeconds = Math.max(0, breakSeconds - 1); 
      updateBreakTimer(); 
      if (breakSeconds <= 0) {
        clearInterval(breakInterval);
      }
    }, 1000);
  }
}

function updateBreakTimer() {
  const m = String(Math.floor(breakSeconds / 60)).padStart(2, '0');
  const s = String(breakSeconds % 60).padStart(2, '0');
  const bt = document.getElementById('breakTimer');
  if (bt) bt.textContent = `${m}:${s}`;
}

connect();
