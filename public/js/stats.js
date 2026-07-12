const WS_PROTOCOL = location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTOCOL}//${location.host}/ws/overlay${location.search}`;
let ws, state = null;
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
    case 'init': 
      state = msg.data; 
      if (state.rosters) updateStatsScene(state.rosters); 
      break;
    case 'score': 
      if (state) {
        state.score = msg.data; 
        if (state.rosters) updateStatsScene(state.rosters); 
      }
      break;
    case 'rosters': 
      if (state) {
        state.rosters = msg.data; 
        updateStatsScene(msg.data); 
      }
      break;
  }
}

function getCharImage(name) {
  const c = allCharacters.find(x => x.name === name);
  return c ? (c.icon || c.image).replace(/^\/?icon\//, 'images/icon/') : '';
}

function getWeaponImage(name) {
  const w = allWeapons.find(x => x.name === name);
  return w ? (w.imagebig || w.image).replace(/^\/?images\/weapons?\//, 'images/weapon/') : '';
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
  return '0,0,0';
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

connect();
