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
      for (let i=0; i<3; i++) {
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
      
      for (let i=0; i<3; i++) {
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

connect();
