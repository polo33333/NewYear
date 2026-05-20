(() => {
    let allCharacters = [];
    let allWeapons = [];
    let savedMatches = [];

    // Fetch all local data
    async function loadData() {
        try {
            const [charRes, weaponRes, savesRes] = await Promise.all([
                fetch('/api/characters').then(r => r.json()),
                fetch('/api/weapons').then(r => r.json()),
                fetch('/api/saves').then(r => r.json())
            ]);

            allCharacters = charRes || [];
            allWeapons = weaponRes || [];
            savedMatches = savesRes || [];

            // Sort by timestamp descending (newest first)
            savedMatches.sort((a, b) => b.timestamp - a.timestamp);

            renderHistory();
        } catch (e) {
            console.error('Failed to load history data:', e);
            const grid = document.getElementById('hist-grid');
            if (grid) {
                grid.innerHTML = `
                    <div class="history-empty-state">
                        <i class="fas fa-exclamation-triangle" style="color: var(--danger)"></i>
                        <p>Lỗi tải dữ liệu lịch sử từ máy chủ: ${e.message}</p>
                    </div>
                `;
            }
        }
    }

    // Helper to render mini avatar circles
    function getCharacterAvatarHTML(name) {
        if (!name) return '';
        const char = allCharacters.find(c => c.name === name);
        let imgSrc = '';

        if (char) {
            imgSrc = char.icon || char.image;
            if (imgSrc) {
                imgSrc = imgSrc.replace(/^\/?icon\//, 'images/icon/');
            }
        }

        if (imgSrc) {
            return `<div class="history-mini-avatar" style="background-image: url('${imgSrc}')" title="${name}"></div>`;
        } else {
            return `<div class="history-mini-avatar no-image" title="${name}"><span>${name.substring(0, 1).toUpperCase()}</span></div>`;
        }
    }

    // Get unique characters used in a match roster
    function getUniqueTeamHeroes(rosters, teamCode) {
        const heroes = new Set();
        const teamData = rosters ? rosters['team' + teamCode] : null;
        if (!teamData) return [];

        for (let r = 1; r <= 6; r++) {
            const round = teamData['round' + r];
            if (round && round.heroes) {
                round.heroes.forEach(h => {
                    if (h && h.trim()) heroes.add(h.trim());
                });
            }
        }
        return Array.from(heroes);
    }

    // Render the saves grid
    function renderHistory() {
        const grid = document.getElementById('hist-grid');
        const searchVal = document.getElementById('hist-search-input')?.value.toLowerCase() || '';

        if (!grid) return;
        grid.innerHTML = '';

        // Filter saves by search term (team names or bracket label)
        const filteredSaves = savedMatches.filter(save => {
            const nameA = save.score?.teamA?.name || 'TEAM A';
            const nameB = save.score?.teamB?.name || 'TEAM B';
            const bracket = save.tournament?.bracketLabel || '';
            return nameA.toLowerCase().includes(searchVal) ||
                nameB.toLowerCase().includes(searchVal) ||
                bracket.toLowerCase().includes(searchVal);
        });

        if (filteredSaves.length === 0) {
            grid.innerHTML = `
                <div class="history-empty-state">
                    <i class="fas fa-history"></i>
                    <p>${searchVal ? 'Không tìm thấy trận đấu nào khớp với từ khóa tìm kiếm.' : 'Chưa có kết quả trận đấu nào được lưu trữ.'}</p>
                    <a href="#" onclick="window.switchTab('control'); return false;" class="btn-goto-control"><i class="fas fa-gamepad"></i> Đến Trang Điều Khiển</a>
                </div>
            `;
            return;
        }

        filteredSaves.forEach(save => {
            const card = document.createElement('div');
            card.className = 'history-card';

            // Extract metadata
            const dateStr = new Date(save.timestamp).toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            const bracketLabel = save.tournament?.bracketLabel || 'TOURNAMENT MATCH';
            const teamAName = save.score?.teamA?.name || 'TEAM A';
            const teamBName = save.score?.teamB?.name || 'TEAM B';
            const teamAScore = save.score?.teamA?.score ?? 0;
            const teamBScore = save.score?.teamB?.score ?? 0;

            const syncedTabs = save.syncedTabs || [];
            let syncedTabsHTML = '';
            if (syncedTabs.length > 0) {
                syncedTabsHTML = `
                    <div class="history-synced-tabs" style="margin: 8px 0; padding: 6px 10px; background: rgba(16, 185, 129, 0.05); border: 1px dashed rgba(16, 185, 129, 0.25); border-radius: 6px; font-size: 11px; display: flex; align-items: center; gap: 6px; color: #10b981; flex-wrap: wrap;">
                        <i class="fab fa-google-drive" style="font-size: 12px; flex-shrink: 0;"></i>
                        <span style="font-weight: 600; opacity: 0.85; flex-shrink: 0;">Synced:</span>
                        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                            ${syncedTabs.map(tab => `<span class="synced-tab-tag" style="background: rgba(16, 185, 129, 0.15); padding: 1px 6px; border-radius: 4px; font-weight: 700; font-family: 'Inter', sans-serif;">${tab}</span>`).join('')}
                        </div>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="history-card-header">
                    <span class="history-bracket-label">${bracketLabel}</span>
                    <span class="history-timestamp">${dateStr}</span>
                </div>
                
                <div class="history-match-preview">
                    <div class="history-team-preview team-a">
                        <span class="history-team-name" title="${teamAName}">${teamAName}</span>
                        <span class="history-team-score">${teamAScore}</span>
                    </div>
                    <div class="history-vs-divider">
                        <span>VS</span>
                        <div class="history-vs-line"></div>
                    </div>
                    <div class="history-team-preview team-b">
                        <span class="history-team-name" title="${teamBName}">${teamBName}</span>
                        <span class="history-team-score">${teamBScore}</span>
                    </div>
                </div>

                ${syncedTabsHTML}

                <div class="history-card-footer" style="flex-wrap: wrap; gap: 6px;">
                    <button class="btn-history-load" onclick="loadSave('${save.id}')" style="flex: 1.2; min-width: 90px; font-size: 11px; padding: 6px 10px;">
                        <i class="fas fa-folder-open"></i> Tải
                    </button>
                    <button class="btn-history-load" onclick="showMatchDetails('${save.id}')" style="flex: 1.5; min-width: 100px; font-size: 11px; padding: 6px 10px; background: rgba(255, 255, 255, 0.06); color: #fff; border: 1px solid rgba(255,255,255,0.12);">
                        <i class="fas fa-eye"></i> Chi Tiết
                    </button>
                    <button class="btn-history-load" onclick="syncMatchToSheets('${save.id}', this)" style="flex: 1.5; min-width: 100px; font-size: 11px; padding: 6px 10px; background: rgba(16, 185, 129, 0.08); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2);">
                        <i class="fab fa-google-drive"></i> G-Sheets
                    </button>
                    <button class="btn-history-delete" onclick="deleteSave('${save.id}')" style="flex: unset; width: 28px; padding: 6px 0; aspect-ratio: 1; font-size: 11px;" title="Xóa">
                        <i class="fas fa-trash-can"></i>
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    // Load save slot
    async function loadSave(id) {
        const save = savedMatches.find(s => s.id === id);
        if (!save) return;

        const teamAName = save.score?.teamA?.name || 'TEAM A';
        const teamBName = save.score?.teamB?.name || 'TEAM B';

        const confirmed = await showConfirm(
            "Tải Trận Đấu",
            `Bạn có chắc chắn muốn TẢI (LOAD) kết quả trận đấu:\n"${teamAName} vs ${teamBName}"\nĐè lên phiên hoạt động hiện tại trên OBS và Control Panel?`
        );
        if (!confirmed) {
            return;
        }

        try {
            const res = await fetch(`/api/saves/${id}/load`, { method: 'POST' });
            if (res.ok) {
                showToast('Đã tải dữ liệu trận đấu thành công!', 'success');
                // Switch back to Control Tab and notify/reload the controls
                setTimeout(() => {
                    window.switchTab('control');
                    if (window.loadRosterFromServer) {
                        window.loadRosterFromServer();
                    }
                    if (window.loadCurrentMatchScore) {
                        window.loadCurrentMatchScore();
                    }
                }, 1000);
            } else {
                const err = await res.json();
                showToast('Lỗi tải dữ liệu: ' + (err.error || 'Lỗi không xác định'), 'error');
            }
        } catch (e) {
            showToast('Lỗi kết nối máy chủ: ' + e.message, 'error');
        }
    }

    // Delete save slot
    async function deleteSave(id) {
        const confirmed = await showConfirm(
            "Xóa Trận Đấu",
            "Bạn có chắc chắn muốn xóa vĩnh viễn kết quả trận đấu đã lưu này? Hành động này không thể hoàn tác."
        );
        if (!confirmed) {
            return;
        }

        try {
            const res = await fetch(`/api/saves/${id}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('Đã xóa bản ghi thành công!', 'success');
                // Reload local list
                loadData();
            } else {
                showToast('Lỗi xóa kết quả trận đấu!', 'error');
            }
        } catch (e) {
            showToast('Lỗi kết nối máy chủ: ' + e.message, 'error');
        }
    }

    // Show match details modal
    function showMatchDetails(id) {
        const save = savedMatches.find(s => s.id === id);
        if (!save) return;

        const modal = document.getElementById('hist-details-modal');
        if (!modal) return;

        // Set metadata
        const teamAName = save.score?.teamA?.name || 'TEAM A';
        const teamBName = save.score?.teamB?.name || 'TEAM B';
        const bracketLabel = save.tournament?.bracketLabel || 'TOURNAMENT MATCH';

        const matchTitle = document.getElementById('hist-modal-match-title');
        const teamALabel = document.getElementById('hist-modal-team-a-label');
        const teamBLabel = document.getElementById('hist-modal-team-b-label');

        if (matchTitle) matchTitle.textContent = `${teamAName} vs ${teamBName} (${bracketLabel})`;
        if (teamALabel) teamALabel.textContent = teamAName;
        if (teamBLabel) teamBLabel.textContent = teamBName;

        // Render rounds breakdown
        const containerA = document.getElementById('hist-roundsA-detail-container');
        const containerB = document.getElementById('hist-roundsB-detail-container');

        if (containerA && containerB) {
            containerA.innerHTML = '';
            containerB.innerHTML = '';

            for (let r = 1; r <= 6; r++) {
                containerA.appendChild(createDetailRoundRow('A', r, save.rosters?.teamA?.[`round${r}`]));
                containerB.appendChild(createDetailRoundRow('B', r, save.rosters?.teamB?.[`round${r}`]));
            }
        }

        modal.style.display = 'flex';
    }

    function closeDetailsModal() {
        const modal = document.getElementById('hist-details-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Render a single read-only round row for history details
    function createDetailRoundRow(teamCode, r, roundData) {
        const row = document.createElement('div');
        row.className = 'history-round-row';

        // Roster heroes
        let heroesHTML = '';
        const heroes = roundData?.heroes || [];
        const heroRcs = roundData?.heroRcs || [];

        for (let i = 0; i < 3; i++) {
            const hName = heroes[i];
            if (hName && hName.trim()) {
                const char = allCharacters.find(c => c.name === hName);
                let imgSrc = char?.icon || char?.image || '';
                if (imgSrc) imgSrc = imgSrc.replace(/^\/?icon\//, 'images/icon/');

                const rcVal = heroRcs[i] ?? '0';

                heroesHTML += `
                    <div class="history-item-slot" style="background-image: url('${imgSrc}')" title="${hName}">
                        <span class="history-slot-tag hero">RC${rcVal}</span>
                    </div>
                `;
            } else {
                heroesHTML += `
                    <div class="history-item-slot empty" title="Trống">
                        <i class="fas fa-user"></i>
                    </div>
                `;
            }
        }

        // Roster weapons
        let weaponsHTML = '';
        const weapons = roundData?.weapons || [];
        const weaponRs = roundData?.weaponRs || [];

        for (let i = 0; i < 3; i++) {
            const wName = weapons[i];
            if (wName && wName.trim()) {
                const weapon = allWeapons.find(w => w.name === wName);
                let imgSrc = weapon?.imagebig || weapon?.image || '';
                if (imgSrc) imgSrc = imgSrc.replace(/^\/?images\/weapons?\//, 'images/weapon/');

                const rVal = weaponRs[i] ?? '1';

                weaponsHTML += `
                    <div class="history-item-slot" style="background-image: url('${imgSrc}')" title="${wName}">
                        <span class="history-slot-tag weapon">R${rVal}</span>
                    </div>
                `;
            } else {
                weaponsHTML += `
                    <div class="history-item-slot empty" title="Trống">
                        <i class="fas fa-gavel"></i>
                    </div>
                `;
            }
        }

        const points = roundData?.points ?? 0;
        const deduction = roundData?.deduction ?? 0;
        const buyPoints = roundData?.buyPoints ?? 0;
        const net = points - deduction - buyPoints;

        row.innerHTML = `
            <div class="history-round-label">R${r}</div>
            <div class="history-round-items">
                ${heroesHTML}
                <div style="width: 1px; height: 30px; background: rgba(255,255,255,0.05); margin: 0 2px;"></div>
                ${weaponsHTML}
            </div>
            <div class="history-score-display">
                <div class="history-score-item">
                    <span class="history-score-label">PT</span>
                    <span class="history-score-value plus">+${points}</span>
                </div>
                <div class="history-score-item">
                    <span class="history-score-label" title="Điểm trừ nhân vật / vũ khí">DT</span>
                    <span class="history-score-value minus">-${deduction}</span>
                </div>
                <div class="history-score-item">
                    <span class="history-score-label" style="color: #ff9f43;" title="Điểm mua lượt">BUY</span>
                    <span class="history-score-value minus" style="color: #ff9f43;">-${buyPoints}</span>
                </div>
                <div class="history-score-item">
                    <span class="history-score-label">NET</span>
                    <span class="history-score-value net">${net}</span>
                </div>
            </div>
        `;

        return row;
    }

    // Sync match data to Google Sheets
    async function syncMatchToSheets(id, btn) {
        const tabName = await showPrompt("Đồng Bộ Google Sheets", "Nhập tên tab Google Sheet muốn đồng bộ:", "Match History");
        if (tabName === null) {
            // User clicked Cancel
            return;
        }
        const cleanTabName = tabName.trim();
        if (!cleanTabName) {
            showToast('Tên tab không được để trống!', 'error');
            return;
        }

        const oldHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';

        try {
            const res = await fetch(`/api/saves/${id}/sync-sheets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tabName: cleanTabName })
            });
            const data = await res.json();

            if (res.ok) {
                showToast('✓ Đồng bộ Google Sheets thành công!', 'success');

                // Update syncedTabs in-memory immediately
                const saveIndex = savedMatches.findIndex(s => s.id === id);
                if (saveIndex !== -1) {
                    savedMatches[saveIndex].syncedTabs = savedMatches[saveIndex].syncedTabs || [];
                    if (!savedMatches[saveIndex].syncedTabs.includes(cleanTabName)) {
                        savedMatches[saveIndex].syncedTabs.push(cleanTabName);
                    }
                    renderHistory();
                }

                btn.innerHTML = '<i class="fas fa-check-circle"></i> Synced';
                btn.style.color = '#10b981';
                btn.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                btn.style.background = 'rgba(16, 185, 129, 0.15)';
                setTimeout(() => {
                    btn.innerHTML = oldHtml;
                    btn.disabled = false;
                    btn.style.color = '';
                    btn.style.borderColor = '';
                    btn.style.background = '';
                }, 3000);
            } else {
                showToast('Lỗi: ' + (data.error || 'Không thể đồng bộ'), 'error');
                btn.innerHTML = '<i class="fas fa-exclamation-circle"></i> Thử lại';
                btn.style.color = 'var(--danger)';
                btn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                btn.style.background = 'rgba(239, 68, 68, 0.05)';
                setTimeout(() => {
                    btn.innerHTML = oldHtml;
                    btn.disabled = false;
                    btn.style.color = '';
                    btn.style.borderColor = '';
                    btn.style.background = '';
                }, 3000);
            }
        } catch (e) {
            showToast('Lỗi kết nối máy chủ: ' + e.message, 'error');
            btn.innerHTML = oldHtml;
            btn.disabled = false;
        }
    }

    // Bind loadSave and deleteSave globally to be accessible from inline HTML onclicks
    window.loadSave = loadSave;
    window.deleteSave = deleteSave;
    window.showMatchDetails = showMatchDetails;
    window.closeDetailsModal = closeDetailsModal;
    window.syncMatchToSheets = syncMatchToSheets;
    window.refreshHistory = loadData;

    // Initialize immediately
    const searchInput = document.getElementById('hist-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', renderHistory);
    }
    loadData();
})();
