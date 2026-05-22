let ws, state = null;
let currentObsToken = null;
const clientId = 'control_' + Math.random().toString(36).substring(2, 9);

function resizePreview() {
  const c = document.getElementById('preview-container'), f = document.getElementById('preview-iframe');
  if (!c || !f) return;
  const s = c.clientWidth / 1920;
  f.style.transform = `scale(${s})`;
}

function openFullscreen() {
  const elem = document.getElementById("preview-iframe");
  if (elem.requestFullscreen) { elem.requestFullscreen(); }
  else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); }
  else if (elem.msRequestFullscreen) { elem.msRequestFullscreen(); }
}

function connect() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${protocol}//${location.host}/ws/control`);
  ws.onopen = () => { document.getElementById('conn-dot').className = 'status-dot online'; document.getElementById('conn-text').textContent = 'CONNECTED'; };
  ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
  ws.onclose = () => { document.getElementById('conn-dot').className = 'status-dot'; document.getElementById('conn-text').textContent = 'OFFLINE'; setTimeout(connect, 2000); };
}

function handleMessage(msg) {
  if (msg.type === 'init') { state = msg.data; syncUI(); }
  else if (msg.type === 'score') { state.score = msg.data; syncScoreUI(); }
  else if (msg.type === 'scene') { state.scene = msg.value; syncSceneUI(); }
  else if (msg.type === 'overlays') { state.overlays = msg.data; syncOverlayUI(); }
  else if (msg.type === 'rosters') {
    state.rosters = msg.data;
    if (msg.senderId !== clientId) {
      syncRosterUI();
    }
  }
  else if (msg.type === 'settings_update') {
    syncUI();
  }
}

function syncUI() {
  if (!state) return;
  syncSceneUI(); syncOverlayUI(); syncScoreUI(); syncRosterUI();
  const nA = state.score.teamA.name || 'TEAM A';
  const nB = state.score.teamB.name || 'TEAM B';
  document.getElementById('nameA').value = nA;
  document.getElementById('nameB').value = nB;
  document.getElementById('label-teamA').textContent = nA || 'TEAM A';
  document.getElementById('label-teamB').textContent = nB || 'TEAM B';

  document.getElementById('bracket-label').value = state.tournament?.bracketLabel || '';
  document.getElementById('break-duration').value = state.break?.duration / 60 || 5;
  document.getElementById('ticker-input').value = state.ticker?.items.join('\n') || '';

  const host = location.origin;
  fetch('/api/settings').then(r => r.json()).then(s => {
    const tokenVal = s.obsToken || 'kdstream2026';
    const token = '?token=' + tokenVal;
    document.getElementById('url-full').textContent = host + '/live' + token;
    document.getElementById('url-sb').textContent = host + '/scoreboard' + token;
    document.getElementById('url-ticker').textContent = host + '/ticker' + token;
    document.getElementById('url-stats').textContent = host + '/stats' + token;
    
    // Only reload/update preview iframe if token actually changed
    if (currentObsToken !== tokenVal) {
      currentObsToken = tokenVal;
      document.getElementById('preview-iframe').src = host + '/live' + token + '&t=' + Date.now();
    }
  }).catch(err => {
    const token = '?token=kdstream2026';
    document.getElementById('url-full').textContent = host + '/live' + token;
    document.getElementById('url-sb').textContent = host + '/scoreboard' + token;
    document.getElementById('url-ticker').textContent = host + '/ticker' + token;
    document.getElementById('url-stats').textContent = host + '/stats' + token;
  });
}

function syncScoreUI() {
  const sA = state.score.teamA.score;
  const sB = state.score.teamB.score;
  document.getElementById('scoreA').value = sA;
  document.getElementById('scoreB').value = sB;
  const displayA = document.getElementById('scoreA-display');
  const displayB = document.getElementById('scoreB-display');
  if (displayA) displayA.textContent = sA;
  if (displayB) displayB.textContent = sB;
}

function syncRosterUI() {
  // Support both 'roster' (old) and 'rosters' (new/correct)
  const rosters = state.rosters || state.roster;
  if (!rosters) return;

  for (let r = 1; r <= 6; r++) {
    ['A', 'B'].forEach(teamCode => {
      const teamKey = 'team' + teamCode;
      const teamData = rosters[teamKey] || {};
      const roundData = teamData['round' + r] || { heroes: [], weapons: [], points: '', deduction: '' };

      // Sync Heroes
      for (let h = 1; h <= 3; h++) {
        const val = (roundData.heroes && roundData.heroes[h - 1]) || '';
        const id = `${teamCode}r${r}h${h}`;
        const input = document.getElementById('t' + id);
        const sq = document.getElementById('sq' + id);
        if (input) input.value = val;
        if (sq) {
          if (val) sq.classList.add('filled');
          else sq.classList.remove('filled');
          applyImageToSquare(sq, val, false);
        }
      }

      // Sync Weapons
      for (let w = 1; w <= 3; w++) {
        const val = (roundData.weapons && roundData.weapons[w - 1]) || '';
        const id = `${teamCode}r${r}w${w}`;
        const input = document.getElementById('t' + id);
        const sq = document.getElementById('sq' + id);
        if (input) input.value = val;
        if (sq) {
          if (val) sq.classList.add('filled');
          else sq.classList.remove('filled');
          applyImageToSquare(sq, val, true);
        }
      }

      // Sync Points & Deduction
      const pInput = document.getElementById(`t${teamCode}r${r}p`);
      const dInput = document.getElementById(`t${teamCode}r${r}d`);
      const buyInput = document.getElementById(`t${teamCode}r${r}buy`);
      const netDiv = document.getElementById(`t${teamCode}r${r}net`);
      if (pInput) pInput.value = roundData.points ?? '';
      if (dInput) dInput.value = roundData.deduction ?? '';
      if (buyInput) buyInput.value = roundData.buyPoints ?? '';

      if (netDiv) {
        const net = (roundData.points || 0) - (roundData.deduction || 0) - (roundData.buyPoints || 0);
        netDiv.innerText = net;
        netDiv.style.color = net < 0 ? '#ff4444' : (net > 0 ? '#00f5ff' : '#fff');
      }

      // Disable the submit button if the round is already synced/submitted on server
      const hasSyncedData = !!teamData['round' + r];
      const btnSubmit = document.getElementById(`btn-submit-${teamCode}r${r}`);
      if (btnSubmit) {
        if (hasSyncedData) {
          btnSubmit.disabled = true;
          btnSubmit.classList.add('disabled');
        } else {
          btnSubmit.disabled = false;
          btnSubmit.classList.remove('disabled');
        }
      }
    });
  }
}

function syncSceneUI() { document.querySelectorAll('.scene-btn').forEach(b => b.classList.toggle('active', b.dataset.scene === state.scene)); }
function syncOverlayUI() { for (let k in state.overlays) { let el = document.getElementById('tog-' + k); if (el) el.classList.toggle('on', state.overlays[k]); } }
function send(m) {
  if (ws && ws.readyState === 1) {
    m.senderId = clientId;
    ws.send(JSON.stringify(m));
  }
}
function setScene(s) { send({ type: 'set_scene', value: s }); }
function toggleOverlay(k) { send({ type: 'toggle_overlay', key: k }); }
function adjScore(t, v) {
  const news = Math.max(0, state.score[t].score + v);
  const data = {}; data[t] = { ...state.score[t], score: news };
  send({ type: 'update_score', data });
}
function updateScoreInput(t) {
  const val = parseInt(document.getElementById('score' + t.slice(-1)).value) || 0;
  const news = Math.max(0, val);
  const data = {}; data[t] = { ...state.score[t], score: news };
  send({ type: 'update_score', data });
}
async function resetMatch() {
  const confirmed = await showConfirm("Xoá Dữ Liệu", "Bạn có chắc chắn muốn xoá toàn bộ dữ liệu trận đấu hiện tại?");
  if (!confirmed) return;
  const nA = 'TEAM A';
  const nB = 'TEAM B';
  const defSubtitle = 'GRAND FINALS — 2026';
  document.getElementById('nameA').value = nA;
  document.getElementById('nameB').value = nB;
  document.getElementById('scoreA').value = 0;
  document.getElementById('scoreB').value = 0;
  document.getElementById('bracket-label').value = defSubtitle;
  document.getElementById('break-duration').value = 5;

  const scoreData = {
    teamA: { ...state.score.teamA, name: nA, score: 0 },
    teamB: { ...state.score.teamB, name: nB, score: 0 }
  };
  send({ type: 'update_score', data: scoreData });
  send({ type: 'update_tournament', data: { bracketLabel: defSubtitle } });
  send({ type: 'update_break', data: { duration: 300 } });
}

function updateMatch() {
  const nA = document.getElementById('nameA').value;
  const nB = document.getElementById('nameB').value;

  document.getElementById('label-teamA').textContent = 'TEAM A: ' + nA;
  document.getElementById('label-teamB').textContent = 'TEAM B: ' + nB;

  const scoreData = {
    teamA: { ...state.score.teamA, name: nA },
    teamB: { ...state.score.teamB, name: nB }
  };
  send({ type: 'update_score', data: scoreData });
  send({ type: 'update_tournament', data: { bracketLabel: document.getElementById('bracket-label').value } });
  send({ type: 'update_break', data: { duration: (parseFloat(document.getElementById('break-duration').value) || 5) * 60 } });
}

function updateTicker() {
  const items = document.getElementById('ticker-input').value.split('\n').filter(i => i.trim());
  send({ type: 'update_ticker', data: { items } });
}

function updateSq(id) {
  const input = document.getElementById('t' + id);
  const sq = document.getElementById('sq' + id);
  if (!input || !sq) return;
  const val = input.value.trim();
  const isWeapon = id.includes('w');
  if (val) sq.classList.add('filled');
  else sq.classList.remove('filled');
  applyImageToSquare(sq, val, isWeapon);

  // Tự động tính điểm trừ khi thay đổi Tướng/Vũ khí
  const match = id.match(/([AB])r(\d+)/);
  if (match) {
    window.calculateAllDeductions(match[1]);
    if (window.markRowDirty) {
      window.markRowDirty(match[1], parseInt(match[2], 10));
    }
  }

  if (window.updateRosterLocal) {
    window.updateRosterLocal();
  }
}

window.calculateAllDeductions = function (team) {
  const usedChars = new Set();
  const usedWeapons = new Set();

  for (let r = 1; r <= 6; r++) {
    let roundDeduction = 0;

    // Tướng (h1 -> h3)
    for (let i = 1; i <= 3; i++) {
      const nameInput = document.getElementById(`t${team}r${r}h${i}`);
      const rcInput = document.getElementById(`sl${team}r${r}h${i}`);
      if (nameInput && nameInput.value) {
        const charName = nameInput.value;
        const char = allCharacters.find(c => c.name === charName);
        if (char && rcInput && !usedChars.has(charName)) {
          const val = parseInt(rcInput.value, 10);
          roundDeduction += (char[`rc${val}`] || 0);
          usedChars.add(charName); // Chỉ trừ điểm lần đầu tiên
        }
      }
    }

    // Vũ khí (w1 -> w3)
    for (let i = 1; i <= 3; i++) {
      const nameInput = document.getElementById(`t${team}r${r}w${i}`);
      const rInput = document.getElementById(`sl${team}r${r}w${i}`);
      if (nameInput && nameInput.value) {
        const wpName = nameInput.value;
        const wp = allWeapons.find(w => w.name === wpName);
        if (wp && rInput && !usedWeapons.has(wpName)) {
          const val = parseInt(rInput.value, 10);
          roundDeduction += (wp[`r${val}`] || 0);
          usedWeapons.add(wpName); // Chỉ trừ điểm lần đầu tiên
        }
      }
    }

    const dInput = document.getElementById(`t${team}r${r}d`);
    if (dInput) {
      dInput.value = roundDeduction;
    }
  }
};

function updateRoster() {
  const rosterData = { teamA: {}, teamB: {} };

  for (let r = 1; r <= 6; r++) {
    ['A', 'B'].forEach(teamCode => {
      const p = parseInt(document.getElementById(`t${teamCode}r${r}p`)?.value) || 0;
      const d = parseInt(document.getElementById(`t${teamCode}r${r}d`)?.value) || 0;
      const buy = parseInt(document.getElementById(`t${teamCode}r${r}buy`)?.value) || 0;
      const net = p - d - buy;
      const netDiv = document.getElementById(`t${teamCode}r${r}net`);
      if (netDiv) {
        netDiv.innerText = net;
        netDiv.style.color = net < 0 ? '#ff4444' : (net > 0 ? '#00f5ff' : '#fff');
      }

      const teamKey = 'team' + teamCode;
      rosterData[teamKey]['round' + r] = {
        heroes: [
          document.getElementById(`t${teamCode}r${r}h1`)?.value || '',
          document.getElementById(`t${teamCode}r${r}h2`)?.value || '',
          document.getElementById(`t${teamCode}r${r}h3`)?.value || ''
        ],
        heroRcs: [
          document.getElementById(`sl${teamCode}r${r}h1`)?.value || '0',
          document.getElementById(`sl${teamCode}r${r}h2`)?.value || '0',
          document.getElementById(`sl${teamCode}r${r}h3`)?.value || '0'
        ],
        weapons: [
          document.getElementById(`t${teamCode}r${r}w1`)?.value || '',
          document.getElementById(`t${teamCode}r${r}w2`)?.value || '',
          document.getElementById(`t${teamCode}r${r}w3`)?.value || ''
        ],
        weaponRs: [
          document.getElementById(`sl${teamCode}r${r}w1`)?.value || '1',
          document.getElementById(`sl${teamCode}r${r}w2`)?.value || '1',
          document.getElementById(`sl${teamCode}r${r}w3`)?.value || '1'
        ],
        points: p,
        deduction: d,
        buyPoints: buy
      };
    });
  }

  send({ type: 'update_roster', data: rosterData });
}

window.updateRosterLocal = function () {
  for (let r = 1; r <= 6; r++) {
    ['A', 'B'].forEach(teamCode => {
      const p = parseInt(document.getElementById(`t${teamCode}r${r}p`)?.value) || 0;
      const d = parseInt(document.getElementById(`t${teamCode}r${r}d`)?.value) || 0;
      const buy = parseInt(document.getElementById(`t${teamCode}r${r}buy`)?.value) || 0;
      const net = p - d - buy;
      const netDiv = document.getElementById(`t${teamCode}r${r}net`);
      if (netDiv) {
        netDiv.innerText = net;
        netDiv.style.color = net < 0 ? '#ff4444' : (net > 0 ? '#00f5ff' : '#fff');
      }
    });
  }
};

window.syncSingleRow = function (teamCode, r) {
  const p = parseInt(document.getElementById(`t${teamCode}r${r}p`)?.value) || 0;
  const d = parseInt(document.getElementById(`t${teamCode}r${r}d`)?.value) || 0;
  const buy = parseInt(document.getElementById(`t${teamCode}r${r}buy`)?.value) || 0;
  const net = p - d - buy;
  const netDiv = document.getElementById(`t${teamCode}r${r}net`);
  if (netDiv) {
    netDiv.innerText = net;
    netDiv.style.color = net < 0 ? '#ff4444' : (net > 0 ? '#00f5ff' : '#fff');
  }

  const teamKey = 'team' + teamCode;
  const singleRosterData = {};
  singleRosterData[teamKey] = {};
  singleRosterData[teamKey]['round' + r] = {
    heroes: [
      document.getElementById(`t${teamCode}r${r}h1`)?.value || '',
      document.getElementById(`t${teamCode}r${r}h2`)?.value || '',
      document.getElementById(`t${teamCode}r${r}h3`)?.value || ''
    ],
    heroRcs: [
      document.getElementById(`sl${teamCode}r${r}h1`)?.value || '0',
      document.getElementById(`sl${teamCode}r${r}h2`)?.value || '0',
      document.getElementById(`sl${teamCode}r${r}h3`)?.value || '0'
    ],
    weapons: [
      document.getElementById(`t${teamCode}r${r}w1`)?.value || '',
      document.getElementById(`t${teamCode}r${r}w2`)?.value || '',
      document.getElementById(`t${teamCode}r${r}w3`)?.value || ''
    ],
    weaponRs: [
      document.getElementById(`sl${teamCode}r${r}w1`)?.value || '1',
      document.getElementById(`sl${teamCode}r${r}w2`)?.value || '1',
      document.getElementById(`sl${teamCode}r${r}w3`)?.value || '1'
    ],
    points: p,
    deduction: d,
    buyPoints: buy
  };

  send({ type: 'update_roster', data: singleRosterData });

  // Disable the submit button immediately upon successful sync
  const btn = document.getElementById(`btn-submit-${teamCode}r${r}`);
  if (btn) {
    btn.disabled = true;
    btn.classList.add('disabled');
  }
};

window.submitRow = function (teamCode, r, event) {
  if (event) event.stopPropagation();
  window.syncSingleRow(teamCode, r);
  showToast(`Đã cập nhật và đồng bộ kết quả Vòng ${r} của Team ${teamCode}!`, 'success');
};

function copyUrl(id, btn) {
  const text = document.getElementById(id).textContent;
  navigator.clipboard.writeText(text).then(() => {
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> COPIED';
    btn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    btn.style.color = '#10b981';
    setTimeout(() => {
      btn.innerHTML = oldHtml;
      btn.style.borderColor = '';
      btn.style.color = '';
    }, 1000);
  });
}

window.addEventListener('resize', () => resizePreview());
document.getElementById('preview-iframe').addEventListener('load', () => resizePreview());
connect();
resizePreview();

// --- MODAL SELECTION LOGIC ---
let allCharacters = [];
let allWeapons = [];
let currentSelectionTarget = '';
let currentSelectionType = '';
let multiSelection = []; // Mảng chứa các item được chọn
let currentFilters = { rank: '', element: '', weapon: '' }; // State của các bộ lọc

window.setFilter = function (type, val, el) {
  currentFilters[type] = val;
  const siblings = el.parentElement.querySelectorAll('.filter-btn');
  siblings.forEach(s => s.classList.remove('active'));
  el.classList.add('active');
  filterModalItems();
};

function getRankColor(rank) {
  switch (rank) {
    case 5: return '#ffd700'; // Vàng
    case 4: return '#b366ff'; // Tím
    case 3: return '#4d94ff'; // Xanh dương
    case 2: return '#66cc66'; // Xanh lá
    case 1: return '#b3b3b3'; // Xám
    default: return '';
  }
}

function applyImageToSquare(sq, name, isWeapon) {
  if (!sq) return;
  const icon = sq.querySelector('i');
  let span = sq.querySelector('span');

  if (!name) {
    sq.style.backgroundImage = '';
    sq.style.borderColor = '';
    sq.classList.remove('rank-5', 'rank-4', 'rank-3', 'rank-2', 'rank-1');
    if (icon) {
      icon.style.display = '';
    }
    if (span) {
      span.textContent = isWeapon ? 'W' : 'C';
      span.style.display = icon ? 'none' : '';
    }
    sq.title = '';
    return;
  }

  const list = isWeapon ? allWeapons : allCharacters;
  const item = list.find(i => i.name === name);
  let imgSrc = '';

  if (item) {
    sq.classList.remove('rank-5', 'rank-4', 'rank-3', 'rank-2', 'rank-1');
    sq.classList.add(`rank-${item.rank}`);
    imgSrc = isWeapon ? (item.imagebig || item.image) : (item.icon || item.image);
    if (imgSrc && isWeapon) {
      imgSrc = imgSrc.replace(/^\/?images\/weapons?\//, 'images/weapon/');
    } else if (imgSrc && !isWeapon) {
      imgSrc = imgSrc.replace(/^\/?icon\//, 'images/icon/');
    }
  }

  if (imgSrc) {
    sq.style.backgroundImage = `url('${imgSrc}')`;
    sq.style.backgroundSize = 'cover';
    sq.style.backgroundPosition = 'center';
    if (icon) {
      icon.style.display = 'none';
    }
    if (span) {
      span.style.display = 'none';
    }
  } else {
    sq.style.backgroundImage = '';
    if (icon) {
      icon.style.display = 'none';
    }
    if (!span) {
      span = document.createElement('span');
      sq.appendChild(span);
    }
    span.textContent = name;
    span.style.display = '';
  }

  sq.title = name;
}

Promise.all([
  fetch('/api/characters').then(r => r.json()).then(data => {
    allCharacters = data.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
  }),
  fetch('/api/weapons').then(r => r.json()).then(data => {
    allWeapons = data.sort((a, b) => {
      const rankDiff = (b.rank || 0) - (a.rank || 0);
      if (rankDiff !== 0) return rankDiff;
      return (a.name || '').localeCompare(b.name || '', 'vi');
    });
  })
]).then(() => {
  if (state) syncRosterUI(); // Cập nhật lại UI khi đã có data hình ảnh
}).catch(console.error);

window.openSelectionModal = function (targetId, type) {
  currentSelectionTarget = targetId; // 'Ar1h1' etc.
  currentSelectionType = type;
  multiSelection = []; // Reset lựa chọn mỗi khi mở modal

  // Tự động load các item đã chọn trước đó
  const match = targetId.match(/^(.*[hw])(\d+)$/);
  if (match) {
    const prefix = match[1];
    // Dù click vào ô nào (1, 2 hay 3) cũng load toàn bộ 3 ô của hàng đó
    for (let i = 1; i <= 3; i++) {
      const input = document.getElementById('t' + prefix + i);
      if (input && input.value) {
        multiSelection.push(input.value);
      }
    }
  }
  currentFilters = { rank: '', element: '', weapon: type === 'weapon' ? 'smart' : '' };

  document.getElementById('modal-title').innerText = type === 'character' ? 'Select Characters (Max 3)' : 'Select Weapons (Max 3)';
  document.getElementById('modal-search').value = '';

  // Reset CSS cho các nhóm filter
  document.querySelectorAll('.filter-group').forEach(group => {
    const btns = group.querySelectorAll('.filter-btn');
    btns.forEach(b => b.classList.remove('active'));
  });

  // Set active default
  const rankAll = document.querySelector('#modal-filter-rank-group .filter-btn');
  if (rankAll) rankAll.classList.add('active');

  const elementAll = document.querySelector('#modal-filter-element-group .filter-btn');
  if (elementAll) elementAll.classList.add('active');

  const weaponSmart = document.getElementById('filter-weapon-smart');
  const weaponAll = document.querySelector('#modal-filter-weapon-group .filter-btn:not(#filter-weapon-smart)');

  if (type === 'weapon') {
    if (weaponSmart) {
      weaponSmart.style.display = '';
      weaponSmart.classList.add('active');
    }
  } else {
    if (weaponSmart) {
      weaponSmart.style.display = 'none';
    }
    if (weaponAll) {
      weaponAll.classList.add('active');
    }
  }

  // Ẩn/Hiện filter hợp lý
  document.getElementById('modal-filter-element-group').style.display = type === 'weapon' ? 'none' : 'flex';
  document.getElementById('modal-filter-weapon-group').style.display = 'flex';
  document.getElementById('filter-rank-3').style.display = type === 'character' ? 'none' : '';
  document.getElementById('filter-rank-2').style.display = type === 'character' ? 'none' : '';
  document.getElementById('filter-rank-1').style.display = type === 'character' ? 'none' : '';

  filterModalItems();

  document.getElementById('selection-modal').style.display = 'flex';
};

window.closeSelectionModal = function () {
  document.getElementById('selection-modal').style.display = 'none';
};

window.filterModalItems = function () {
  const q = document.getElementById('modal-search').value.toLowerCase();
  const { rank, element: el, weapon: wp } = currentFilters;

  const items = currentSelectionType === 'character' ? allCharacters : allWeapons;
  const matchTarget = currentSelectionTarget.match(/([AB])r(\d+)/);
  const currentTeam = matchTarget ? matchTarget[1] : 'A';
  const currentRound = matchTarget ? parseInt(matchTarget[2], 10) : 1;

  // Lấy ra danh sách weapon type của các character đã chọn trong round hiện tại nếu đang dùng bộ lọc Smart
  let allowedWeaponTypes = [];
  if (currentSelectionType === 'weapon' && wp === 'smart') {
    for (let j = 1; j <= 3; j++) {
      const charInput = document.getElementById(`t${currentTeam}r${currentRound}h${j}`);
      if (charInput && charInput.value) {
        const char = allCharacters.find(c => c.name === charInput.value);
        if (char && char.weapon) {
          allowedWeaponTypes.push(String(char.weapon));
        }
      }
    }
  }

  const filtered = items.filter(i => {
    if (i.isActive === false) return false;
    if (q && !(i.name || '').toLowerCase().includes(q)) return false;
    if (rank && i.rank != rank) return false;
    if (currentSelectionType === 'character' && el && i.element != el) return false;
    // Json char dùng `weapon`, Json weapon dùng `typeid`
    if (wp) {
      if (currentSelectionType === 'weapon' && wp === 'smart') {
        if (allowedWeaponTypes.length > 0 && !allowedWeaponTypes.includes(String(i.typeid))) {
          return false;
        }
      } else {
        if ((i.weapon || i.typeid) != wp) return false;
      }
    }

    // Lọc theo Energy đối với Character
    if (currentSelectionType === 'character') {
      let uses = 0;
      for (let r = 1; r <= 6; r++) {
        if (r === currentRound) continue; // Bỏ qua round đang chọn
        for (let j = 1; j <= 3; j++) {
          const input = document.getElementById(`t${currentTeam}r${r}h${j}`);
          if (input && input.value === i.name) {
            uses++;
          }
        }
      }
      const energy = i.energy || 1;
      i._remainingEnergy = Math.max(0, energy - uses);
      i._disabled = i._remainingEnergy === 0;
    } else {
      i._disabled = false;
      i._remainingEnergy = null; // Vũ khí không có energy
    }

    return true;
  });
  renderModalItems(filtered);
};

window.renderModalItems = function (items) {
  const grid = document.getElementById('modal-grid');
  grid.innerHTML = '';

  // Vị trí bắt đầu luôn là 1 để quản lý cả 3 ô
  const maxAllowed = 3;

  // Cập nhật text nút confirm
  const confirmBtn = document.querySelector('#selection-modal button[onclick="confirmMultiSelection()"]');
  if (confirmBtn) {
    confirmBtn.innerText = `CONFIRM (${multiSelection.length}/${maxAllowed})`;
  }

  items.forEach(item => {
    if (!item.name) return;
    const el = document.createElement('div');

    // Kiểm tra có trong mảng chọn không
    const selIndex = multiSelection.indexOf(item.name);
    const isSelected = selIndex !== -1;

    // Cấu hình CSS nếu bị disable (hết energy)
    const isDisabled = item._disabled;
    el.className = `modal-item-card rank-${item.rank}` + (isSelected ? ' is-selected' : '');

    // Áp dụng các thuộc tính style động
    el.style.opacity = (isDisabled && !isSelected) ? '0.3' : '1';
    el.style.cursor = (isDisabled && !isSelected) ? 'not-allowed' : 'pointer';

    if (!isDisabled || isSelected) {
      el.onclick = () => handleItemClick(item.name);
    }

    // Tạo huy hiệu đánh số 1, 2, 3
    let badgeHtml = '';
    if (isSelected) {
      const displayNum = 1 + selIndex;
      badgeHtml = `<div class="modal-item-badge">${displayNum}</div>`;
    }

    // Hiển thị Energy (nếu là character)
    let energyHtml = '';
    if (currentSelectionType === 'character' && item._remainingEnergy !== null) {
      const eColor = item._remainingEnergy > 0 ? '#00f5ff' : '#ff4444';
      energyHtml = `<div class="modal-item-energy" style="color:${eColor}">⚡ ${item._remainingEnergy}</div>`;
    }

    // Tùy theo cấu trúc JSON mà lấy ảnh. Character JSON dùng icon, Weapon ưu tiên imagebig
    let imgSrc = currentSelectionType === 'weapon' ? (item.imagebig || item.image) : (item.icon || item.image);
    if (imgSrc && currentSelectionType === 'weapon') {
      imgSrc = imgSrc.replace(/^\/?images\/weapons?\//, 'images/weapon/'); // Đảm bảo đúng đường dẫn nãy tải
    } else if (imgSrc && currentSelectionType === 'character') {
      imgSrc = imgSrc.replace(/^\/?icon\//, 'images/icon/');
    }

    el.innerHTML = `
      ${badgeHtml}
      ${energyHtml}
      <div class="modal-item-image">
        ${imgSrc ? `<img src="${imgSrc}" class="modal-item-avatar" alt="${item.name}" loading="lazy">` : ''}
        <div class="modal-item-stars">${'★'.repeat(item.rank)}</div>
      </div>
      <div class="modal-item-name">${item.name}</div>
    `;

    grid.appendChild(el);
  });
};

window.handleItemClick = function (name) {
  const maxAllowed = 3;

  const idx = multiSelection.indexOf(name);
  if (idx !== -1) {
    multiSelection.splice(idx, 1); // Bỏ chọn
  } else {
    if (multiSelection.length < maxAllowed) {
      multiSelection.push(name); // Thêm chọn
    }
  }
  filterModalItems(); // Render lại để hiện số
};

window.clearSquare = function () {
  const input = document.getElementById('t' + currentSelectionTarget);
  if (input) {
    input.value = '';
    updateSq(currentSelectionTarget);
  }
  closeSelectionModal();
};

window.confirmMultiSelection = function () {
  // Lấy ra tiền tố (ví dụ 'Ar1h' hoặc 'Br2w') và vị trí bắt đầu
  const match = currentSelectionTarget.match(/^(.*[hw])(\d+)$/);
  if (!match) return;
  // Luôn bắt đầu từ 1
  const prefix = match[1];

  // Xoá các ô từ 1 đến 3 trước khi gán mới
  for (let i = 1; i <= 3; i++) {
    const inputId = 't' + prefix + i;
    const input = document.getElementById(inputId);
    if (input) {
      input.value = '';
      updateSq(prefix + i);
    }
  }

  multiSelection.forEach((name, idx) => {
    const targetIdx = 1 + idx;
    if (targetIdx <= 3) {
      const inputId = 't' + prefix + targetIdx;
      const input = document.getElementById(inputId);
      if (input) {
        input.value = name;
        updateSq(prefix + targetIdx);
      }
    }
  });

  closeSelectionModal();
};

window.selectItem = function (name) {
  // Hàm cũ, có thể không dùng nữa nhưng giữ lại phòng trường hợp khác
  const input = document.getElementById('t' + currentSelectionTarget);
  if (input) {
    input.value = name;
    updateSq(currentSelectionTarget);
  }
  closeSelectionModal();
};

function generateRounds() {
  const containerA = document.getElementById('roundsA-container');
  const containerB = document.getElementById('roundsB-container');
  const createRow = (team, r) => {
    const row = document.createElement('div');
    row.className = 'round-row';
    row.addEventListener('click', function () {
      document.querySelectorAll('.round-row').forEach(el => el.classList.remove('active'));
      this.classList.add('active');
    });
    row.innerHTML = `
  <div class="round-label">R${r}</div>
  <div class="round-heroes-container">
    ${[1, 2, 3].map(i => `
      <div class="char-col">
        <div class="char-square" id="sq${team}r${r}h${i}" onclick="openSelectionModal('${team}r${r}h${i}', 'character')"><i class="fas fa-user" style="font-size: 20px;opacity:0.4;"></i><input type="hidden" id="t${team}r${r}h${i}" onchange="updateSq('${team}r${r}h${i}')"></div>
        <div class="rc-label">RC</div>
        <div class="step-container">
          <button class="step-btn" onclick="stepValue('sl${team}r${r}h${i}', -1, 0, 6, '${team}', ${r})"><i class="fas fa-minus"></i></button>
          <div id="lbl-sl${team}r${r}h${i}" class="step-val">0</div>
          <button class="step-btn" onclick="stepValue('sl${team}r${r}h${i}', 1, 0, 6, '${team}', ${r})"><i class="fas fa-plus"></i></button>
          <input type="hidden" id="sl${team}r${r}h${i}" value="0">
        </div>
      </div>
    `).join('')}
  </div>
  <div class="divider-v-short"></div>
  <div class="round-heroes-container">
    ${[1, 2, 3].map(i => `
      <div class="char-col">
        <div class="char-square weapon-square" id="sq${team}r${r}w${i}" onclick="openSelectionModal('${team}r${r}w${i}', 'weapon')"><i class="fas fa-gavel" style="font-size: 20px;opacity:0.4;"></i><input type="hidden" id="t${team}r${r}w${i}" onchange="updateSq('${team}r${r}w${i}'); window.markRowDirty('${team}', ${r})"></div>
        <div class="r-label">R</div>
        <div class="step-container step-container-wp">
          <button class="step-btn" onclick="stepValue('sl${team}r${r}w${i}', -1, 1, 5, '${team}', ${r})"><i class="fas fa-minus"></i></button>
          <div id="lbl-sl${team}r${r}w${i}" class="step-val">1</div>
          <button class="step-btn" onclick="stepValue('sl${team}r${r}w${i}', 1, 1, 5, '${team}', ${r})"><i class="fas fa-plus"></i></button>
          <input type="hidden" id="sl${team}r${r}w${i}" value="1">
        </div>
      </div>
    `).join('')}
  </div>
  <div class="flex-1"></div>
  <div class="score-inputs-wrapper">
     <div class="score-input-col">
       <div class="score-input-row">
         <span class="score-sign-plus">+</span>
         <input type="number" id="t${team}r${r}p" placeholder="0" onchange="updateRosterLocal()" oninput="window.markRowDirty('${team}', ${r})" class="score-pt-input" title="Điểm cộng">
       </div>
       <div class="score-input-row">
         <span class="score-sign-minus">&minus;</span>
         <input type="number" id="t${team}r${r}d" placeholder="0" readonly class="score-deduct-input" title="Điểm trừ RC và R">
       </div>
       <div class="score-input-row">
         <span class="score-sign-minus" style="color: #ff9f43;">&minus;</span>
         <input type="number" id="t${team}r${r}buy" placeholder="0" onchange="updateRosterLocal()" oninput="window.markRowDirty('${team}', ${r})" class="score-buy-input" title="Điểm mua lượt">
       </div>
     </div>
     <div class="score-net-wrapper">
       <span class="score-sign-equal">=</span>
       <div id="t${team}r${r}net" class="score-net-box" title="Tổng điểm">0</div>
     </div>
     <div class="score-actions-col">
        <button class="btn-submit-row" id="btn-submit-${team}r${r}" onclick="submitRow('${team}', ${r}, event)" title="Đồng bộ Round ${r}"><i class="fas fa-paper-plane"></i></button>
        <button class="btn-clear-row" onclick="clearRow('${team}', ${r}, event)" title="Clear Round ${r}"><i class="fas fa-arrow-rotate-right"></i></button>
      </div>
  </div>
`;
    return row;
  };
  for (let r = 1; r <= 6; r++) {
    containerA.appendChild(createRow('A', r));
    containerB.appendChild(createRow('B', r));
  }
}

window.markRowDirty = function (teamCode, r) {
  const btn = document.getElementById(`btn-submit-${teamCode}r${r}`);
  if (btn) {
    btn.disabled = false;
    btn.classList.remove('disabled');
  }
};

window.stepValue = function (id, delta, min, max, team, r) {
  const input = document.getElementById(id);
  const lbl = document.getElementById('lbl-' + id);
  if (!input || !lbl) return;
  let val = parseInt(input.value, 10);
  val += delta;
  if (val < min) val = min;
  if (val > max) val = max;
  input.value = val;
  lbl.innerText = val;
  if (window.calculateAllDeductions) {
    window.calculateAllDeductions(team);
  }
  if (window.updateRosterLocal) {
    window.updateRosterLocal();
  }
  window.markRowDirty(team, r);
};

generateRounds();

window.clearRoster = async function () {
  const confirmed = await showConfirm("Xoá Đội Hình", "Bạn có chắc chắn muốn xoá toàn bộ dữ liệu đội hình và vũ khí?");
  if (!confirmed) return;
  for (let r = 1; r <= 6; r++) {
    ['A', 'B'].forEach(teamCode => {
      const p = document.getElementById(`t${teamCode}r${r}p`);
      const d = document.getElementById(`t${teamCode}r${r}d`);
      const buy = document.getElementById(`t${teamCode}r${r}buy`);
      if (p) p.value = '';
      if (d) d.value = '';
      if (buy) buy.value = '';

      for (let i = 1; i <= 3; i++) {
        const hc = document.getElementById(`t${teamCode}r${r}h${i}`);
        const wc = document.getElementById(`t${teamCode}r${r}w${i}`);
        if (hc) { hc.value = ''; updateSq(`${teamCode}r${r}h${i}`); }
        if (wc) { wc.value = ''; updateSq(`${teamCode}r${r}w${i}`); }

        const hRc = document.getElementById(`sl${teamCode}r${r}h${i}`);
        const hRcLbl = document.getElementById(`lbl-sl${teamCode}r${r}h${i}`);
        if (hRc) hRc.value = '0';
        if (hRcLbl) hRcLbl.innerText = '0';

        const wR = document.getElementById(`sl${teamCode}r${r}w${i}`);
        const wRLbl = document.getElementById(`lbl-sl${teamCode}r${r}w${i}`);
        if (wR) wR.value = '1';
        if (wRLbl) wRLbl.innerText = '1';
      }
    });
  }
  updateRoster();
};

window.clearRow = async function (teamCode, r, event) {
  if (event) event.stopPropagation();
  const confirmed = await showConfirm("Xoá Vòng Đấu", `Bạn có chắc chắn muốn xoá dữ liệu Vòng ${r} của Team ${teamCode}?`);
  if (!confirmed) return;

  const p = document.getElementById(`t${teamCode}r${r}p`);
  const d = document.getElementById(`t${teamCode}r${r}d`);
  const buy = document.getElementById(`t${teamCode}r${r}buy`);
  if (p) p.value = '';
  if (d) d.value = '';
  if (buy) buy.value = '';

  for (let i = 1; i <= 3; i++) {
    const hc = document.getElementById(`t${teamCode}r${r}h${i}`);
    const wc = document.getElementById(`t${teamCode}r${r}w${i}`);
    if (hc) { hc.value = ''; updateSq(`${teamCode}r${r}h${i}`); }
    if (wc) { wc.value = ''; updateSq(`${teamCode}r${r}w${i}`); }

    const hRc = document.getElementById(`sl${teamCode}r${r}h${i}`);
    const hRcLbl = document.getElementById(`lbl-sl${teamCode}r${r}h${i}`);
    if (hRc) hRc.value = '0';
    if (hRcLbl) hRcLbl.innerText = '0';

    const wR = document.getElementById(`sl${teamCode}r${r}w${i}`);
    const wRLbl = document.getElementById(`lbl-sl${teamCode}r${r}w${i}`);
    if (wR) wR.value = '1';
    if (wRLbl) wRLbl.innerText = '1';
  }

  if (window.syncSingleRow) {
    window.syncSingleRow(teamCode, r);
  }
  window.markRowDirty(teamCode, r);
};

window.saveRoster = async function () {
  // Confirm before saving to prevent accidental slot creation
  const confirmed = await showConfirm("Lưu Trận Đấu", "Bạn có chắc chắn muốn lưu kết quả trận đấu hiện tại thành một bản ghi mới?");
  if (!confirmed) return;

  // 1. Force update to ensure everything is synced
  updateRoster();

  // 2. Call server-side API to create a new save slot
  fetch('/api/saves', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(data => {
      if (data.ok) {
        showToast('Đã lưu kết quả trận đấu hiện tại thành công!', 'success');
      } else {
        showToast('Lỗi lưu dữ liệu: ' + (data.error || 'Lỗi không xác định.'), 'error');
      }
    })
    .catch(err => {
      showToast('Lỗi kết nối máy chủ: ' + err.message, 'error');
    });
};

// Register Service Worker for PWA (Open as App) support, pointing to js/sw.js with root scope
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/js/sw.js', { scope: '/' })
      .then(reg => console.log('ServiceWorker registered:', reg.scope))
      .catch(err => console.log('ServiceWorker error:', err));
  });
}

