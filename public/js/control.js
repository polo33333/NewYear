let ws, state = null;
let currentObsToken = null;
const clientId = 'control_' + Math.random().toString(36).substring(2, 9);
window.dirtyRows = new Set();

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
  const currentToken = localStorage.getItem('kdone_auth_token') || '';
  const currentRoomId = sessionStorage.getItem('kdone_current_room_id') || '';
  ws = new WebSocket(`${protocol}//${location.host}/ws/control?token=${currentToken}&roomId=${currentRoomId}`);
  ws.onopen = () => {
    document.querySelectorAll('.conn-dot, #conn-dot').forEach(el => el.className = 'conn-dot status-dot online');
    document.querySelectorAll('.conn-text, #conn-text').forEach(el => el.textContent = 'CONNECTED');

    if (typeof mp !== 'undefined' && mp.audio) {
      const isPlaying = !mp.audio.paused;
      const name = (mp.playlist && mp.playlist[mp.currentIndex]) ? mp.playlist[mp.currentIndex].name : '';
      send({ type: 'song', data: { name, isPlaying } });
    }
  };
  ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
  ws.onclose = () => {
    document.querySelectorAll('.conn-dot, #conn-dot').forEach(el => el.className = 'conn-dot status-dot');
    document.querySelectorAll('.conn-text, #conn-text').forEach(el => el.textContent = 'OFFLINE');
    setTimeout(connect, 2000);
  };
}

function handleMessage(msg) {
  if (msg.type === 'init') {
    state = msg.data;
    if (msg.roomId) {
      sessionStorage.setItem('kdone_current_room_id', msg.roomId);
    }
    syncUI();
  }
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
  else if (msg.type === 'server_stats') {
    updateSystemStats(msg.data);
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
  document.getElementById('bracket-subtitle').value = state.tournament?.bracketSubtitle || '';
  document.getElementById('break-duration').value = state.break?.duration / 60 || 5;
  document.getElementById('ticker-input').value = state.ticker?.items.join('\n') || '';

  const host = location.origin;
  fetch('/api/settings').then(r => r.json()).then(s => {
    const isSync = !!s.isSync;
    const tokenVal = isSync ? (s.obsToken || 'kdstream2026') : (localStorage.getItem('kdone_auth_token') || 'kdstream2026');
    let token = '?token=' + tokenVal;

    // Nếu là chế độ độc lập (isSync == false), nối thêm roomId động để OBS kết nối đúng phòng
    if (!isSync) {
      const currentRoomId = sessionStorage.getItem('kdone_current_room_id') || '';
      if (currentRoomId) {
        token += '&roomId=' + currentRoomId;
      }
    }

    document.getElementById('url-full').textContent = host + '/live' + token;
    document.getElementById('url-sb').textContent = host + '/scoreboard' + token;
    // document.getElementById('url-ticker').textContent = host + '/ticker' + token;
    document.getElementById('url-stats').textContent = host + '/stats' + token;

    // Only reload/update preview iframe if preview URL actually changed
    const previewUrl = host + '/live' + token;
    const iframe = document.getElementById('preview-iframe');
    if (iframe.getAttribute('data-current-url') !== previewUrl) {
      iframe.setAttribute('data-current-url', previewUrl);
      const loader = document.getElementById('preview-loader');
      if (loader) loader.style.display = 'flex';
      iframe.style.opacity = '0';
      iframe.src = previewUrl + '&t=' + Date.now();
    }
  }).catch(err => {
    const token = '?token=kdstream2026';
    document.getElementById('url-full').textContent = host + '/live' + token;
    document.getElementById('url-sb').textContent = host + '/scoreboard' + token;
    // document.getElementById('url-ticker').textContent = host + '/ticker' + token;
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
      if (window.dirtyRows && window.dirtyRows.has(`${teamCode}-${r}`)) {
        // Bỏ qua cập nhật hàng này từ server để giữ lại thay đổi chưa submit của người dùng
        return;
      }
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

        // Sync RC values
        const rcVal = (roundData.heroRcs && roundData.heroRcs[h - 1]) || '0';
        const rcInput = document.getElementById('sl' + id);
        const rcLbl = document.getElementById('lbl-sl' + id);
        if (rcInput) rcInput.value = rcVal;
        if (rcLbl) rcLbl.innerText = rcVal;
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

        // Sync R values
        const rVal = (roundData.weaponRs && roundData.weaponRs[w - 1]) || '1';
        const rInput = document.getElementById('sl' + id);
        const rLbl = document.getElementById('lbl-sl' + id);
        if (rInput) rInput.value = rVal;
        if (rLbl) rLbl.innerText = rVal;
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
  const confirmed = await showConfirm("Xoá Dữ Liệu", "Xóa toàn bộ dữ liệu trận đấu hiện tại?\nHành động không thể hoàn tác.");
  if (!confirmed) return;
  const nA = 'TEAM A';
  const nB = 'TEAM B';
  const defSubtitle = 'GRAND FINALS — 2026';
  document.getElementById('nameA').value = nA;
  document.getElementById('nameB').value = nB;
  document.getElementById('bracket-label').value = defSubtitle;
  document.getElementById('break-duration').value = 5;

  // Update rp-team-bar names instantly
  document.getElementById('label-teamA').textContent = nA;
  document.getElementById('label-teamB').textContent = nB;

  const scoreData = {
    teamA: { ...state.score.teamA, name: nA },
    teamB: { ...state.score.teamB, name: nB }
  };
  send({ type: 'update_score', data: scoreData });
  send({ type: 'update_tournament', data: { bracketLabel: defSubtitle, bracketSubtitle: '' } });
  send({ type: 'update_break', data: { duration: 300 } });
}

function updateMatch() {
  const nA = document.getElementById('nameA').value;
  const nB = document.getElementById('nameB').value;

  document.getElementById('label-teamA').textContent = nA;
  document.getElementById('label-teamB').textContent = nB;

  const scoreData = {
    teamA: { ...state.score.teamA, name: nA },
    teamB: { ...state.score.teamB, name: nB }
  };
  send({ type: 'update_score', data: scoreData });
  send({ type: 'update_tournament', data: { bracketLabel: document.getElementById('bracket-label').value, bracketSubtitle: document.getElementById('bracket-subtitle').value } });
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
  if (window.dirtyRows) {
    window.dirtyRows.delete(`${teamCode}-${r}`);
  }
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
    btn.innerHTML = '<i class="fas fa-check"></i> ĐÃ SAO CHÉP';
    btn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    btn.style.color = '#10b981';
    setTimeout(() => {
      btn.innerHTML = oldHtml;
      btn.style.borderColor = '';
      btn.style.color = '';
    }, 1000);
  });
}

const startTime = Date.now();
const pingHistory = [];
const maxPingPoints = 20;

function initClientTelemetry() {
  const ramVal = document.getElementById('client-ram-val');
  if (ramVal) {
    const ram = navigator.deviceMemory || 'N/A';
    ramVal.textContent = ram !== 'N/A' ? `~${ram} GB` : 'N/A';
  }

  const resVal = document.getElementById('client-res-val');
  if (resVal) {
    resVal.textContent = `${window.screen.width} x ${window.screen.height}`;
  }

  setInterval(updateUptime, 1000);
  updateUptime();

  // Resize is handled in global event listener
}

function updateUptime() {
  const uptimeVal = document.getElementById('client-uptime-val');
  if (!uptimeVal) return;
  const diffMs = Date.now() - startTime;
  const diffSecs = Math.floor(diffMs / 1000);
  const hrs = Math.floor(diffSecs / 3600);
  const mins = Math.floor((diffSecs % 3600) / 60);
  const secs = diffSecs % 60;
  const pad = (num) => String(num).padStart(2, '0');
  uptimeVal.textContent = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

function addPingToChart(ping) {
  pingHistory.push(ping);
  if (pingHistory.length > maxPingPoints) {
    pingHistory.shift();
  }
  drawPingChart();
}

function drawPingChart() {
  const canvas = document.getElementById('sys-ping-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);
  if (pingHistory.length < 2) return;

  let maxVal = Math.max(...pingHistory);
  let minVal = Math.min(...pingHistory);
  if (maxVal === minVal) {
    maxVal = minVal + 10;
    minVal = Math.max(0, minVal - 10);
  }

  const range = maxVal - minVal;
  const padding = range * 0.2;
  const min = Math.max(0, minVal - padding);
  const max = maxVal + padding;

  // Update Y-Axis labels
  const yTopEl = document.getElementById('sn-y-top');
  const yMidEl = document.getElementById('sn-y-mid');
  const yBotEl = document.getElementById('sn-y-bot');
  if (yTopEl && yMidEl && yBotEl) {
    yTopEl.textContent = Math.round(max) + ' ms';
    yMidEl.textContent = Math.round((max + min) / 2) + ' ms';
    yBotEl.textContent = Math.round(min) + ' ms';
  }

  const points = pingHistory.map((val, idx) => {
    const x = (idx / (maxPingPoints - 1)) * w;
    const y = h - ((val - min) / (max - min)) * (h - 6) - 3;
    return { x, y, val };
  });

  const latestPing = pingHistory[pingHistory.length - 1];
  let themeColor = 'rgb(8 173 255)';
  let rgbaBase = '0, 245, 255';

  if (latestPing > 120) {
    themeColor = '#ef4444';
    rgbaBase = '239, 68, 68';
  } else if (latestPing > 60) {
    themeColor = '#f59e0b';
    rgbaBase = '245, 158, 11';
  }

  // Update value color
  const valEl = document.getElementById('chart-ping-val');
  if (valEl) {
    // textContent is managed by measurePing now, just update styling
    valEl.style.color = themeColor;
  }

  // Calculate Trend
  const trendEl = document.getElementById('chart-ping-trend');
  const trendIconEl = document.getElementById('chart-ping-trend-icon');
  const trendValEl = document.getElementById('chart-ping-trend-val');
  if (trendEl && pingHistory.length > Math.floor(maxPingPoints / 2)) {
    const olderHalf = pingHistory.slice(0, Math.floor(maxPingPoints / 2));
    const oldAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;

    if (oldAvg > 0) {
      const diff = ((latestPing - oldAvg) / oldAvg) * 100;
      if (Math.abs(diff) < 2) {
        trendEl.className = 'sn-trend';
        trendEl.style.color = 'var(--text-dim)';
        if (trendIconEl) trendIconEl.innerHTML = '<i class="fas fa-minus"></i>';
        if (trendValEl) trendValEl.textContent = 'Ổn định';
      } else if (diff < 0) {
        trendEl.className = 'sn-trend good';
        trendEl.style.color = 'var(--success)';
        if (trendIconEl) trendIconEl.innerHTML = '<i class="fas fa-arrow-down"></i>';
        if (trendValEl) trendValEl.textContent = Math.abs(diff).toFixed(0) + '% tốt hơn';
      } else {
        trendEl.className = 'sn-trend bad';
        trendEl.style.color = 'var(--danger)';
        if (trendIconEl) trendIconEl.innerHTML = '<i class="fas fa-arrow-up"></i>';
        if (trendValEl) trendValEl.textContent = Math.abs(diff).toFixed(0) + '% kém hơn';
      }
    }
  }

  // Draw Grid Lines (matches 3 Y-labels, 5 X-labels)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);

  for (let i = 0; i <= 2; i++) {
    const y = i * (h / 2);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  for (let i = 0; i <= 4; i++) {
    const x = i * (w / 4);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Draw Curve Fill
  const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
  fillGrad.addColorStop(0, `rgba(${rgbaBase}, 0.35)`);
  fillGrad.addColorStop(1, `rgba(${rgbaBase}, 0.0)`);

  ctx.beginPath();
  ctx.moveTo(points[0].x, h);
  ctx.lineTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const cpX = (points[i].x + points[i + 1].x) / 2;
    ctx.bezierCurveTo(cpX, points[i].y, cpX, points[i + 1].y, points[i + 1].x, points[i + 1].y);
  }
  ctx.lineTo(points[points.length - 1].x, h);
  ctx.closePath();
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // Draw Line
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const cpX = (points[i].x + points[i + 1].x) / 2;
    ctx.bezierCurveTo(cpX, points[i].y, cpX, points[i + 1].y, points[i + 1].x, points[i + 1].y);
  }
  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = themeColor;
  ctx.shadowBlur = 6;
  ctx.stroke();

  // Draw active point
  const lastPt = points[points.length - 1];
  ctx.beginPath();
  ctx.stroke();
}

function measurePing() {
  const start = Date.now();
  // Dùng /api/ping thay vì /api/state để giảm bandwidth (chỉ trả về {ok:true,ts:...})
  fetch('/api/ping')
    .then(() => {
      const ping = Date.now() - start;
      const badge = document.getElementById('sys-ping-badge');
      if (badge) {
        badge.textContent = `${ping} ms`;
        badge.className = 'sys-badge-ping';
        if (ping > 150) {
          badge.classList.add('danger');
        } else if (ping > 75) {
          badge.classList.add('warning');
        }
      }

      const chartPingVal = document.getElementById('chart-ping-val');
      if (chartPingVal) {
        chartPingVal.textContent = `${ping} ms`;
      }

      addPingToChart(ping);
    })
    .catch(() => {
      const badge = document.getElementById('sys-ping-badge');
      if (badge) {
        badge.textContent = 'ERR';
        badge.className = 'sys-badge-ping danger';
      }
      const chartPingVal = document.getElementById('chart-ping-val');
      if (chartPingVal) {
        chartPingVal.textContent = 'ERR';
      }
    });
}

// --- INITIALIZATION ---
// Generate the round input DOM elements first
generateRounds();
measurePing();
setInterval(measurePing, 5000);
initClientTelemetry();

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    resizePreview();
    if (typeof drawPingChart === 'function') drawPingChart();
  }, 100);
}); const previewIframe = document.getElementById('preview-iframe');
if (previewIframe) {
  previewIframe.addEventListener('load', () => {
    resizePreview();
    previewIframe.style.opacity = '1';
    const loader = document.getElementById('preview-loader');
    if (loader) loader.style.display = 'none';
  });
}

// Fetch initial state via REST API to ensure it loads instantly and reliably on page load/refresh
fetch('/api/state')
  .then(res => {
    if (!res.ok) throw new Error('HTTP status ' + res.status);
    return res.json();
  })
  .then(data => {
    state = data;
    syncUI();
  })
  .catch(err => {
    console.error('[API] Error fetching initial state:', err);
  })
  .finally(() => {
    // Connect WebSocket for real-time updates after initial load
    connect();
    resizePreview();
  });

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
    confirmBtn.innerText = `XÁC NHẬN (${multiSelection.length}/${maxAllowed})`;
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
      const eColor = item._remainingEnergy > 0 ? '#ffffff' : '#ff4a4a';
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

function createSparkles(element) {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2 + window.scrollX;
  const centerY = rect.top + rect.height / 2 + window.scrollY;

  const colors = ['#00f5ff', '#bd00ff', '#ffd700', '#ff007f', '#ffffff'];

  for (let i = 0; i < 24; i++) {
    const particle = document.createElement('div');
    particle.className = 'sparkle-particle';

    // Randomize size between 3px and 7px
    const size = Math.random() * 5 + 3;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;

    // Randomize color
    particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

    // Set start position at center of element
    particle.style.left = `${centerX - size / 2}px`;
    particle.style.top = `${centerY - size / 2}px`;

    // Randomize travel distance and angle (within a radius of ~50-100px)
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 80 + 40;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance - (Math.random() * 30 + 10); // Slight bias upwards

    particle.style.setProperty('--tx', `${tx}px`);
    particle.style.setProperty('--ty', `${ty}px`);

    // Set a random delay to make the burst look more organic
    particle.style.animationDelay = `${Math.random() * 0.15}s`;

    document.body.appendChild(particle);

    // Clean up particle DOM element after animation ends
    particle.addEventListener('animationend', () => {
      particle.remove();
    });
  }
}

function getSubmittedVal(team, type, name) {
  const rosters = state.rosters || state.roster;
  if (!rosters) return null;
  const teamKey = 'team' + team;
  const teamData = rosters[teamKey];
  if (!teamData) return null;

  for (let r = 1; r <= 6; r++) {
    const roundData = teamData['round' + r];
    if (roundData) {
      if (type === 'h') { // Character
        const heroes = roundData.heroes || [];
        const index = heroes.indexOf(name);
        if (index !== -1) {
          return (roundData.heroRcs && roundData.heroRcs[index]) !== undefined ? String(roundData.heroRcs[index]) : '0';
        }
      } else if (type === 'w') { // Weapon
        const weapons = roundData.weapons || [];
        const index = weapons.indexOf(name);
        if (index !== -1) {
          return (roundData.weaponRs && roundData.weaponRs[index]) !== undefined ? String(roundData.weaponRs[index]) : '1';
        }
      }
    }
  }
  return null;
}

function applyAutoFill(targetId, name) {
  const targetMatch = targetId.match(/^([AB])r(\d+)([hw])\d+$/);
  if (!targetMatch) return false;
  const team = targetMatch[1];
  const type = targetMatch[3];

  const submittedVal = getSubmittedVal(team, type, name);
  const slId = 'sl' + targetId;
  const slInput = document.getElementById(slId);
  const slLbl = document.getElementById('lbl-' + slId);

  if (slInput && slLbl) {
    if (submittedVal !== null) {
      slInput.value = submittedVal;
      slLbl.innerText = submittedVal;

      // Apply magic animation class to the square
      const sqId = 'sq' + targetId;
      const sqElement = document.getElementById(sqId);
      if (sqElement) {
        sqElement.classList.remove('magic-filled');
        void sqElement.offsetWidth; // Trigger reflow
        sqElement.classList.add('magic-filled');
        setTimeout(() => {
          sqElement.classList.remove('magic-filled');
        }, 800);

        // Spawn particle sparkles!
        createSparkles(sqElement);
      }
      return true;
    } else {
      // Reset to default values if not auto-filled
      const defaultVal = type === 'h' ? '0' : '1';
      slInput.value = defaultVal;
      slLbl.innerText = defaultVal;
    }
  }
  return false;
}

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

  const targetMatch = currentSelectionTarget.match(/^([AB])r(\d+)([hw])\d+$/);
  const team = targetMatch ? targetMatch[1] : '';
  const currentRound = targetMatch ? parseInt(targetMatch[2], 10) : 1;

  let magicTriggered = false;

  multiSelection.forEach((name, idx) => {
    const targetIdx = 1 + idx;
    if (targetIdx <= 3) {
      const targetId = prefix + targetIdx;
      const inputId = 't' + targetId;
      const input = document.getElementById(inputId);
      if (input) {
        input.value = name;
        updateSq(targetId);

        // Check and apply auto-fill
        if (applyAutoFill(targetId, name)) {
          magicTriggered = true;
        }
      }
    }
  });

  // Calculate deductions and local update
  if (team && window.calculateAllDeductions) {
    window.calculateAllDeductions(team);
  }
  if (window.updateRosterLocal) {
    window.updateRosterLocal();
  }
  if (team) {
    window.markRowDirty(team, currentRound);
  }

  // If magic was triggered, flash the round row
  if (magicTriggered) {
    const firstSq = document.getElementById('sq' + prefix + '1');
    if (firstSq) {
      const roundRow = firstSq.closest('.round-row');
      if (roundRow) {
        roundRow.classList.remove('magic-row');
        void roundRow.offsetWidth; // Trigger reflow
        roundRow.classList.add('magic-row');
        setTimeout(() => {
          roundRow.classList.remove('magic-row');
        }, 1500);
      }
    }
  }

  closeSelectionModal();
};

window.selectItem = function (name) {
  // Hàm cũ, có thể không dùng nữa nhưng giữ lại phòng trường hợp khác
  const input = document.getElementById('t' + currentSelectionTarget);
  if (input) {
    input.value = name;
    updateSq(currentSelectionTarget);

    const targetMatch = currentSelectionTarget.match(/^([AB])r(\d+)([hw])\d+$/);
    const team = targetMatch ? targetMatch[1] : '';
    const currentRound = targetMatch ? parseInt(targetMatch[2], 10) : 1;

    let magicTriggered = applyAutoFill(currentSelectionTarget, name);

    if (team && window.calculateAllDeductions) {
      window.calculateAllDeductions(team);
    }
    if (window.updateRosterLocal) {
      window.updateRosterLocal();
    }
    if (team) {
      window.markRowDirty(team, currentRound);
    }

    if (magicTriggered) {
      const sq = document.getElementById('sq' + currentSelectionTarget);
      if (sq) {
        const roundRow = sq.closest('.round-row');
        if (roundRow) {
          roundRow.classList.remove('magic-row');
          void roundRow.offsetWidth;
          roundRow.classList.add('magic-row');
          setTimeout(() => {
            roundRow.classList.remove('magic-row');
          }, 1500);
        }
      }
    }
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
  if (window.dirtyRows) {
    window.dirtyRows.add(`${teamCode}-${r}`);
  }
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

window.clearRoster = async function () {
  const confirmed = await showConfirm("Xoá Đội Hình", "Xóa toàn bộ dữ liệu đội hình và vũ khí?");
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
  if (window.dirtyRows) {
    window.dirtyRows.clear();
  }
  updateRoster();
};

window.clearRow = async function (teamCode, r, event) {
  if (event) event.stopPropagation();
  const confirmed = await showConfirm("Xoá Vòng Đấu", `Xóa dữ liệu Vòng ${r} — Team ${teamCode}?`);
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
  const confirmed = await showConfirm("Lưu Trận Đấu", "Lưu kết quả hiện tại thành bản ghi mới?");
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

