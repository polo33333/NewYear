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

    // ── View State ──
    let currentHistoryView = 'card'; // 'table' | 'card'

    // Set view mode (table vs card)
    window.setHistoryView = function (view) {
        currentHistoryView = view;
        document.querySelectorAll('.hist-view-btn').forEach(btn => btn.classList.remove('active'));
        const btn = document.getElementById('btn-view-' + view);
        if (btn) btn.classList.add('active');
        renderHistory();
    };

    // Update stats summary bar
    function updateStatsBar(matches) {
        const totalEl = document.getElementById('stat-total-matches');
        const topTeamEl = document.getElementById('stat-top-team');
        const topWinsEl = document.getElementById('stat-top-wins');
        const latestEl = document.getElementById('stat-latest-match');
        const badgeEl = document.getElementById('subtab-count-badge');

        if (badgeEl) badgeEl.textContent = matches.length;
        if (totalEl) totalEl.textContent = matches.length;

        if (matches.length === 0) {
            if (topTeamEl) topTeamEl.textContent = '—';
            if (topWinsEl) topWinsEl.textContent = '—';
            if (latestEl) latestEl.textContent = '—';
            return;
        }

        // Count wins per team name
        const winCount = {};
        matches.forEach(m => {
            const sA = m.score?.teamA?.score ?? 0;
            const sB = m.score?.teamB?.score ?? 0;
            const nA = m.score?.teamA?.name || 'TEAM A';
            const nB = m.score?.teamB?.name || 'TEAM B';
            if (sA > sB) { winCount[nA] = (winCount[nA] || 0) + 1; }
            else if (sB > sA) { winCount[nB] = (winCount[nB] || 0) + 1; }
        });

        let topTeam = '—', topWins = 0;
        Object.entries(winCount).forEach(([name, wins]) => {
            if (wins > topWins) { topTeam = name; topWins = wins; }
        });

        if (topTeamEl) topTeamEl.textContent = topTeam;
        if (topWinsEl) topWinsEl.textContent = topWins > 0 ? `${topWins} trận` : '—';

        // Latest match
        const latest = matches[0];
        if (latestEl && latest) {
            const nA = latest.score?.teamA?.name || 'A';
            const nB = latest.score?.teamB?.name || 'B';
            latestEl.textContent = `${nA} vs ${nB}`;
            latestEl.title = new Date(latest.timestamp).toLocaleString('vi-VN');
        }
    }

    // Populate bracket filter dropdown
    function populateBracketFilter(matches) {
        const sel = document.getElementById('hist-bracket-filter');
        if (!sel) return;
        const labels = new Set(matches.map(m => m.tournament?.bracketLabel).filter(Boolean));
        // Preserve current selection
        const prev = sel.value;
        sel.innerHTML = '<option value="">Tất cả giải đấu</option>';
        Array.from(labels).sort().forEach(label => {
            const opt = document.createElement('option');
            opt.value = label;
            opt.textContent = label;
            sel.appendChild(opt);
        });
        if (prev) sel.value = prev;
    }

    // Helper to calculate relative time
    function timeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        let interval = Math.floor(seconds / 31536000);
        if (interval >= 1) return interval + "y ago";
        interval = Math.floor(seconds / 2592000);
        if (interval >= 1) return interval + "mo ago";
        interval = Math.floor(seconds / 86400);
        if (interval >= 1) return interval + "d ago";
        interval = Math.floor(seconds / 3600);
        if (interval >= 1) return interval + "h ago";
        interval = Math.floor(seconds / 60);
        if (interval >= 1) return interval + "m ago";
        return seconds < 10 ? "just now" : seconds + "s ago";
    }

    // Helper to calculate total Net score for a team
    function calculateTotalNetScore(rosters, teamCode) {
        const teamData = rosters ? rosters['team' + teamCode] : null;
        if (!teamData) return 0;
        let total = 0;
        for (let r = 1; r <= 6; r++) {
            const round = teamData['round' + r];
            if (round) {
                const points = parseInt(round.points) || 0;
                const deduction = parseInt(round.deduction) || 0;
                const buyPoints = parseInt(round.buyPoints) || 0;
                total += (points - deduction - buyPoints);
            }
        }
        return total;
    }

    // Render card grid view
    function renderHistoryCards(filteredSaves) {
        let html = '<div class="history-card-grid">';
        filteredSaves.forEach(save => {
            const dateStr = new Date(save.timestamp).toLocaleString('vi-VN', {
                hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
            });
            const bracketLabel = save.tournament?.bracketLabel || 'TOURNAMENT MATCH';
            const teamAName = save.score?.teamA?.name || 'TEAM A';
            const teamBName = save.score?.teamB?.name || 'TEAM B';
            const teamAScore = save.score?.teamA?.score ?? 0;
            const teamBScore = save.score?.teamB?.score ?? 0;
            const isWinA = teamAScore > teamBScore;
            const isWinB = teamBScore > teamAScore;
            const isIncomplete = teamAScore === 0 && teamBScore === 0;

            const teamAHeroes = getUniqueTeamHeroes(save.rosters, 'A');
            const teamBHeroes = getUniqueTeamHeroes(save.rosters, 'B');

            // Find first hero to use as background icon
            const firstHero = teamAHeroes[0] || teamBHeroes[0] || '';
            let bgImgSrc = '';
            if (firstHero) {
                const char = allCharacters.find(c => c.name === firstHero);
                if (char) {
                    bgImgSrc = char.icon || char.image || '';
                    if (bgImgSrc) {
                        bgImgSrc = bgImgSrc.replace(/^\/?icon\//, 'images/icon/');
                    }
                }
            }

            outcomeText = `${teamAScore} - ${teamBScore}`;
            if (isIncomplete) {
                outcomeClass = 'outcome-incomplete';
            } else if (isWinA) {
                outcomeClass = 'outcome-win';
            } else {
                outcomeClass = 'outcome-loss';
            }

            const teamAAvatarsHTML = teamAHeroes.slice(0, 3).map(h => getCharacterAvatarHTML(h)).join('') || '<div class="empty-slot"><i class="fas fa-user"></i></div>';
            const teamBAvatarsHTML = teamBHeroes.slice(0, 3).map(h => getCharacterAvatarHTML(h)).join('') || '<div class="empty-slot"><i class="fas fa-user"></i></div>';

            const scoreRatio = teamBScore > 0 ? (teamAScore / teamBScore).toFixed(2) : teamAScore.toFixed(2);
            const netScoreA = calculateTotalNetScore(save.rosters, 'A');

            // Build rounds rows
            let roundsHTML = '';
            let hasAnyRounds = false;
            for (let r = 1; r <= 6; r++) {
                const rA = save.rosters?.teamA?.[`round${r}`];
                const rB = save.rosters?.teamB?.[`round${r}`];

                const hasHeroesA = rA?.heroes && rA.heroes.some(h => h && h.trim());
                const hasHeroesB = rB?.heroes && rB.heroes.some(h => h && h.trim());

                if (!hasHeroesA && !hasHeroesB) {
                    continue; // Skip empty rounds entirely!
                }

                hasAnyRounds = true;
                const netA = rA ? (parseInt(rA.points) || 0) - (parseInt(rA.deduction) || 0) - (parseInt(rA.buyPoints) || 0) : 0;
                const netB = rB ? (parseInt(rB.points) || 0) - (parseInt(rB.deduction) || 0) - (parseInt(rB.buyPoints) || 0) : 0;

                const avsA = rA?.heroes ? rA.heroes.filter(Boolean).slice(0, 3).map(h => getCharacterAvatarHTML(h)).join('') : '';
                const avsB = rB?.heroes ? rB.heroes.filter(Boolean).slice(0, 3).map(h => getCharacterAvatarHTML(h)).join('') : '';

                roundsHTML += `
                    <div class="hist-roster-row">
                        <div class="hist-roster-side left">
                            <span class="hist-roster-name">Round ${r}</span>
                            <div class="hist-roster-avatars">${avsA || '<span style="color: rgba(255,255,255,0.15); font-size:10px;">Trống</span>'}</div>
                            <span class="hist-roster-score" style="color: ${netA < 0 ? 'var(--danger)' : netA > 0 ? 'var(--accent)' : '#fff'}">${netA >= 0 ? '+' : ''}${netA}</span>
                        </div>
                        <div class="hist-roster-vs">VS</div>
                        <div class="hist-roster-side right">
                            <span class="hist-roster-score" style="color: ${netB < 0 ? 'var(--danger)' : netB > 0 ? 'var(--success)' : '#fff'}">${netB >= 0 ? '+' : ''}${netB}</span>
                            <div class="hist-roster-avatars">${avsB || '<span style="color: rgba(255,255,255,0.15); font-size:10px;">Trống</span>'}</div>
                            <span class="hist-roster-name">Round ${r}</span>
                        </div>
                    </div>
                `;
            }

            if (!hasAnyRounds) {
                roundsHTML = `
                    <div class="hist-roster-row empty" style="justify-content: center; opacity: 0.5;">
                        <span style="font-size: 11px; color: rgba(255,255,255,0.4);">Chưa có dữ liệu vòng đấu</span>
                    </div>
                `;
            }

            html += `
                <div class="history-card">
                    <div class="hist-card-left">
                        <div class="hist-card-left-bg" style="background-image: url('${bgImgSrc}')"></div>
                        <div class="hist-card-left-grid">
                            <div class="hist-grid-info-section">
                                <div class="hist-card-map" style="font-style: italic; font-size: 11px; color: rgba(255,255,255,0.5); text-transform: uppercase;">${bracketLabel}</div>
                                <div class="hist-card-teams" style="font-size: 13px; font-weight: 700; color: #fff; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    ${teamAName} vs ${teamBName}
                                </div>
      
                            </div>
                            <div class="hist-grid-score-section">
                                <div class="hist-card-outcome ${outcomeClass}" style="font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 20px;">${outcomeText}</div>
                            </div>
                        </div>
                        
                        <div style="margin-top: auto; width: 100%;">
                            <div class="hist-card-time" style="font-size: 11px; color: rgba(255,255,255,0.4); display: flex; gap: 8px;">
                                <span>${timeAgo(save.timestamp)}</span>
                                <span>•</span>
                                <span>${dateStr}</span>
                            </div>
                            
                            <div class="hist-card-actions">
                                <button class="hist-action-btn btn-load" onclick="loadSave('${save.id}')" title="Tải trận đấu">
                                    <i class="fas fa-folder-open"></i> Tải
                                </button>
                                <button class="hist-action-btn" onclick="showMatchDetails('${save.id}')" title="Chi tiết">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="hist-action-btn" onclick="syncMatchToSheets('${save.id}', this)" title="G-Sheets">
                                    <i class="fab fa-google-drive"></i>
                                </button>
                                <button class="hist-action-btn btn-delete" onclick="deleteSave('${save.id}')" title="Xóa">
                                    <i class="fas fa-trash-can"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="hist-card-right">
                        ${roundsHTML}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        return html;
    }

    // Render the saves grid
    function renderHistory() {
        const grid = document.getElementById('hist-grid');
        const searchVal = document.getElementById('hist-search-input')?.value.toLowerCase() || '';
        const bracketFilter = document.getElementById('hist-bracket-filter')?.value || '';

        if (!grid) return;
        grid.innerHTML = '';

        // Sort savedMatches based on selected sort order
        const sortOrder = document.getElementById('hist-sort-order')?.value || 'desc';
        savedMatches.sort((a, b) => {
            const timeA = a.timestamp || 0;
            const timeB = b.timestamp || 0;
            return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        });

        // Filter saves by search term (team names or bracket label) + bracket filter
        const filteredSaves = savedMatches.filter(save => {
            const nameA = save.score?.teamA?.name || 'TEAM A';
            const nameB = save.score?.teamB?.name || 'TEAM B';
            const bracket = save.tournament?.bracketLabel || '';
            const matchesSearch = nameA.toLowerCase().includes(searchVal) ||
                nameB.toLowerCase().includes(searchVal) ||
                bracket.toLowerCase().includes(searchVal);
            const matchesBracket = !bracketFilter || bracket === bracketFilter;

            return matchesSearch && matchesBracket;
        });

        // Update stats bar using full savedMatches (not filtered)
        updateStatsBar(savedMatches);
        // Populate bracket filter dropdown
        populateBracketFilter(savedMatches);
        // Update badge with filtered count
        const badge = document.getElementById('subtab-count-badge');
        if (badge) badge.textContent = filteredSaves.length;

        if (filteredSaves.length === 0) {
            grid.innerHTML = `
                <div class="history-empty-state">
                    <i class="fas fa-history"></i>
                    <p>${searchVal || bracketFilter ? 'Không tìm thấy trận đấu nào khớp với bộ lọc.' : 'Chưa có kết quả trận đấu nào được lưu trữ.'}</p>
                    <a href="#" onclick="window.switchTab('control'); return false;" class="btn-goto-control"><i class="fas fa-gamepad"></i> Đến Trang Điều Khiển</a>
                </div>
            `;
            return;
        }

        // Render as card or table based on view mode
        if (currentHistoryView === 'card') {
            grid.innerHTML = renderHistoryCards(filteredSaves);
            return;
        }

        // Build premium modern dark table layout
        let tableHTML = `
            <div class="history-table-container">
                <div class="history-table-wrapper">
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th class="col-time">Thời Gian</th>
                                <th class="col-bracket">Giải đấu / Trận</th>
                                <th class="col-matchup" style="text-align: center;">Đối Đầu</th>
                                <th class="col-synced">Google Sheets</th>
                                <th class="col-actions">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        filteredSaves.forEach(save => {
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
            let syncedTabsHTML = '<span style="color: rgba(255,255,255,0.15); font-size: 11px;">Chưa đồng bộ</span>';
            if (syncedTabs.length > 0) {
                syncedTabsHTML = `
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                        ${syncedTabs.map(tab => `<span class="synced-tab-tag" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.25); padding: 2px 6px; border-radius: 4px; font-weight: 700; color: #10b981; font-size: 10px; font-family: 'Inter', sans-serif;">${tab}</span>`).join('')}
                    </div>
                `;
            }

            // Extract character avatars used
            const teamAHeroes = getUniqueTeamHeroes(save.rosters, 'A');
            const teamBHeroes = getUniqueTeamHeroes(save.rosters, 'B');

            const teamAAvatarsHTML = teamAHeroes.slice(0, 3).map(h => getCharacterAvatarHTML(h)).join('');
            const teamBAvatarsHTML = teamBHeroes.slice(0, 3).map(h => getCharacterAvatarHTML(h)).join('');

            const isTeamAWinner = teamAScore > teamBScore;
            const isTeamBWinner = teamBScore > teamAScore;

            tableHTML += `
                <tr>
                    <td class="col-time" data-label="Thời Gian">${dateStr}</td>
                    <td class="col-bracket" data-label="Giải / Trận">
                        <span class="bracket-badge">${bracketLabel}</span>
                    </td>
                    <td class="col-matchup" data-label="Đối Đầu">
                        <div class="matchup-display">
                            <div class="matchup-team team-a ${isTeamAWinner ? 'winner' : ''}">
                                <div class="matchup-team-avatars">${teamAAvatarsHTML}</div>
                                <span class="matchup-team-name" title="${teamAName}">${teamAName}</span>
                            </div>
                            
                            <div class="matchup-score-pill">
                                <span class="score-a">${teamAScore}</span>
                                <span class="divider">:</span>
                                <span class="score-b">${teamBScore}</span>
                            </div>
                            
                            <div class="matchup-team team-b ${isTeamBWinner ? 'winner' : ''}">
                                <span class="matchup-team-name" title="${teamBName}">${teamBName}</span>
                                <div class="matchup-team-avatars">${teamBAvatarsHTML}</div>
                            </div>
                        </div>
                    </td>
                    <td class="col-synced" data-label="Google Sheets">
                        ${syncedTabsHTML}
                    </td>
                    <td class="col-actions" data-label="Thao Tác">
                        <div class="action-btn-group">
                            <button class="action-btn btn-load" onclick="loadSave('${save.id}')" title="Tải trận đấu này">
                                <i class="fas fa-folder-open"></i> Tải
                            </button>
                            <button class="action-btn btn-detail" onclick="showMatchDetails('${save.id}')" title="Chi tiết trận đấu">
                                <i class="fas fa-eye"></i> Chi tiết
                            </button>
                            <button class="action-btn btn-sync" onclick="syncMatchToSheets('${save.id}', this)" title="Đồng bộ G-Sheets">
                                <i class="fab fa-google-drive"></i> G-Sheets
                            </button>
                            <button class="action-btn btn-delete" onclick="deleteSave('${save.id}')" title="Xóa trận đấu">
                                <i class="fas fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tableHTML += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        grid.innerHTML = tableHTML;
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
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang đồng bộ...';

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

    function bindMatchToNode(nodeId, saveId) {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        node.saveId = saveId || null;

        // Re-render
        const el = document.getElementById(nodeId);
        if (el) el.remove();
        renderNodeDOM(node);

        evaluateBracket();
        drawConnections();
    }

    function unbindMatchFromNode(nodeId) {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        node.saveId = null;

        // Re-render
        const el = document.getElementById(nodeId);
        if (el) el.remove();
        renderNodeDOM(node);

        evaluateBracket();
        drawConnections();
    }

    let activeSelectNodeId = null;

    function openBracketSelectModal(nodeId) {
        activeSelectNodeId = nodeId;
        const modal = document.getElementById('bracket-select-modal');
        if (!modal) return;

        document.getElementById('bracket-modal-search').value = '';
        renderBracketSelectModalMatches();

        // Show/hide unbind button depending on if the node currently has a bound match
        const node = nodes.find(n => n.id === nodeId);
        const unbindBtn = document.getElementById('btn-bracket-modal-unbind');
        if (unbindBtn) {
            if (node && node.saveId) {
                unbindBtn.style.display = 'inline-block';
            } else {
                unbindBtn.style.display = 'none';
            }
        }

        modal.style.display = 'flex';
    }

    function closeBracketSelectModal() {
        const modal = document.getElementById('bracket-select-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        activeSelectNodeId = null;
    }

    function renderBracketSelectModalMatches() {
        const list = document.getElementById('bracket-modal-matches-list');
        if (!list) return;

        const searchVal = document.getElementById('bracket-modal-search')?.value.toLowerCase() || '';

        const filtered = savedMatches.filter(s => {
            const nameA = s.score?.teamA?.name || 'TEAM A';
            const nameB = s.score?.teamB?.name || 'TEAM B';
            const bracket = s.tournament?.bracketLabel || '';
            return nameA.toLowerCase().includes(searchVal) ||
                nameB.toLowerCase().includes(searchVal) ||
                bracket.toLowerCase().includes(searchVal);
        });

        if (filtered.length === 0) {
            list.innerHTML = `
                <p style="text-align: center; font-size: 12px; color: var(--text-dim); padding: 20px 0;">Không tìm thấy trận đấu nào.</p>
            `;
            return;
        }

        list.innerHTML = filtered.map(s => {
            const nameA = s.score?.teamA?.name || 'TEAM A';
            const nameB = s.score?.teamB?.name || 'TEAM B';
            const scoreA = s.score?.teamA?.score ?? 0;
            const scoreB = s.score?.teamB?.score ?? 0;
            const bracket = s.tournament?.bracketLabel || 'Trận đấu';
            const dateStr = new Date(s.timestamp).toLocaleString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            return `
                <div class="modal-match-select-item" onclick="selectMatchForNode('${s.id}')" style="display: flex; flex-direction: column; gap: 4px; padding: 10px 14px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; cursor: pointer; transition: all 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: var(--accent); font-weight: 700; text-transform: uppercase;">
                        <span>${bracket}</span>
                        <span style="color: var(--text-dim); font-family: 'DM Mono', monospace; font-weight: 400;">${dateStr}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 600; color: #fff; margin-top: 2px;">
                        <span>${nameA} vs ${nameB}</span>
                        <span style="font-family: 'Outfit', sans-serif; font-weight: 700; color: var(--accent);">${scoreA} - ${scoreB}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function selectMatchForNode(saveId) {
        if (activeSelectNodeId) {
            bindMatchToNode(activeSelectNodeId, saveId);
        }
        closeBracketSelectModal();
    }

    function unbindActiveMatch() {
        if (activeSelectNodeId) {
            unbindMatchFromNode(activeSelectNodeId);
        }
        closeBracketSelectModal();
    }

    // Bind loadSave and deleteSave globally to be accessible from inline HTML onclicks
    window.loadSave = loadSave;
    window.deleteSave = deleteSave;
    window.showMatchDetails = showMatchDetails;
    window.closeDetailsModal = closeDetailsModal;
    window.syncMatchToSheets = syncMatchToSheets;
    window.refreshHistory = loadData;
    window.bindMatchToNode = bindMatchToNode;
    window.unbindMatchFromNode = unbindMatchFromNode;
    window.unbindActiveMatch = unbindActiveMatch;
    window.openBracketSelectModal = openBracketSelectModal;
    window.closeBracketSelectModal = closeBracketSelectModal;
    window.selectMatchForNode = selectMatchForNode;
    window.filterBracketSelectModalMatches = renderBracketSelectModalMatches;

    // ── BRACKET DESIGNER CORE LOGIC ──
    let activeSubTab = 'list';
    let nodes = [];
    let connections = [];
    let pan = { x: 100, y: 100 };
    let zoom = 1.0;
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let activeDragConnection = null;
    let isDrawRegionMode = false;
    let isDrawingRegion = false;
    let startCanvasX = 0;
    let startCanvasY = 0;
    let tempRegionHelper = null;

    // Sub-tab toggling logic
    function switchHistorySubTab(tabName) {
        activeSubTab = tabName;

        // Toggle buttons class
        document.querySelectorAll('.history-subtabs-nav .subtab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.id === 'btn-subtab-' + tabName);
        });

        // Toggle content panes
        document.getElementById('history-list-view').style.display = tabName === 'list' ? 'block' : 'none';
        document.getElementById('history-bracket-view').style.display = tabName === 'bracket' ? 'flex' : 'none';

        // Adjust parent container scroll behavior
        const tabEl = document.getElementById('tab-history');
        if (tabEl) {
            if (tabName === 'bracket') {
                tabEl.style.padding = '12px';
                tabEl.style.overflow = 'hidden';
                initBracketDesigner();

                // Redraw connections after the tab display turns flex and layout settles
                setTimeout(() => {
                    drawConnections();
                }, 100);
            } else {
                tabEl.style.padding = '24px';
                tabEl.style.overflow = 'auto';
            }
        }
    }

    // Initialize Bracket Designer Viewport Listeners
    function initBracketDesigner() {
        const viewport = document.getElementById('bracket-canvas-viewport');
        if (!viewport || viewport.dataset.initialized === 'true') {
            renderBracketSidebarMatches();
            return;
        }
        viewport.dataset.initialized = 'true';

        renderBracketSidebarMatches();
        loadBracketFromServer();
        setupViewportListeners();
    }

    // Rebuild option list for all dropdown selects inside unassigned match nodes on the canvas
    function renderBracketSidebarMatches() {
        const selectEls = document.querySelectorAll('.node-match-select');
        selectEls.forEach(select => {
            const currentVal = select.value;
            select.innerHTML = `
                <option value="">-- Chọn Trận Đấu --</option>
                ${savedMatches.map(s => {
                const nameA = s.score?.teamA?.name || 'TEAM A';
                const nameB = s.score?.teamB?.name || 'TEAM B';
                const bracket = s.tournament?.bracketLabel || 'Trận';
                return `<option value="${s.id}">${nameA} vs ${nameB} (${bracket})</option>`;
            }).join('')}
            `;
            select.value = currentVal;
        });
    }

    // Set up Pan and Zoom Listeners
    function setupViewportListeners() {
        const viewport = document.getElementById('bracket-canvas-viewport');
        const canvas = document.getElementById('bracket-canvas');
        if (!viewport || !canvas) return;

        // Panning and Drawing Mouse Events
        viewport.addEventListener('mousedown', (e) => {
            // Ignore if clicking on nodes, input fields, ports, or buttons
            if (e.target.closest('.bracket-node') || e.target.closest('.canvas-controls-hud') || e.target.closest('.node-port')) {
                return;
            }

            if (isDrawRegionMode) {
                isDrawingRegion = true;
                const rect = canvas.getBoundingClientRect();
                startCanvasX = (e.clientX - rect.left) / zoom;
                startCanvasY = (e.clientY - rect.top) / zoom;

                tempRegionHelper = document.createElement('div');
                tempRegionHelper.style.position = 'absolute';
                tempRegionHelper.style.border = '2px dashed var(--accent)';
                tempRegionHelper.style.background = 'rgba(0, 245, 255, 0.05)';
                tempRegionHelper.style.pointerEvents = 'none';
                tempRegionHelper.style.left = startCanvasX + 'px';
                tempRegionHelper.style.top = startCanvasY + 'px';
                tempRegionHelper.style.width = '0px';
                tempRegionHelper.style.height = '0px';
                tempRegionHelper.style.zIndex = '1000';

                const container = document.getElementById('bracket-nodes-container');
                if (container) container.appendChild(tempRegionHelper);
                return;
            }

            isPanning = true;
            viewport.style.cursor = 'grabbing';
            panStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        });

        document.addEventListener('mousemove', (e) => {
            if (isDrawingRegion && tempRegionHelper) {
                const rect = canvas.getBoundingClientRect();
                const currentCanvasX = (e.clientX - rect.left) / zoom;
                const currentCanvasY = (e.clientY - rect.top) / zoom;

                const left = Math.min(startCanvasX, currentCanvasX);
                const top = Math.min(startCanvasY, currentCanvasY);
                const width = Math.abs(currentCanvasX - startCanvasX);
                const height = Math.abs(currentCanvasY - startCanvasY);

                tempRegionHelper.style.left = left + 'px';
                tempRegionHelper.style.top = top + 'px';
                tempRegionHelper.style.width = width + 'px';
                tempRegionHelper.style.height = height + 'px';
                return;
            }

            if (isPanning) {
                pan.x = e.clientX - panStart.x;
                pan.y = e.clientY - panStart.y;
                updateCanvasTransform();
            }

            // Connection dragging
            if (activeDragConnection) {
                const canvasRect = canvas.getBoundingClientRect();
                const mouseX = (e.clientX - canvasRect.left) / zoom;
                const mouseY = (e.clientY - canvasRect.top) / zoom;

                drawTempConnection(activeDragConnection.startX, activeDragConnection.startY, mouseX, mouseY);
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (isDrawingRegion) {
                isDrawingRegion = false;
                if (tempRegionHelper) {
                    const rect = canvas.getBoundingClientRect();
                    const currentCanvasX = (e.clientX - rect.left) / zoom;
                    const currentCanvasY = (e.clientY - rect.top) / zoom;

                    const left = Math.min(startCanvasX, currentCanvasX);
                    const top = Math.min(startCanvasY, currentCanvasY);
                    const width = Math.abs(currentCanvasX - startCanvasX);
                    const height = Math.abs(currentCanvasY - startCanvasY);

                    tempRegionHelper.remove();
                    tempRegionHelper = null;

                    if (width > 20 && height > 20) {
                        const nodeId = 'node_region_' + Date.now() + '_' + Math.floor(Math.random() * 100);
                        const node = {
                            id: nodeId,
                            type: 'region',
                            x: left,
                            y: top,
                            width: width,
                            height: height,
                            text: 'TÊN VÒNG ĐẤU',
                            colorHex: '#00f5ff'
                        };

                        nodes.push(node);
                        renderNodeDOM(node);
                        drawConnections();
                        showToast('Đã vẽ vùng nền mới thành công!', 'success');
                    }
                }

                isDrawRegionMode = false;
                viewport.style.cursor = 'grab';
                return;
            }

            if (isPanning) {
                isPanning = false;
                viewport.style.cursor = 'grab';
            }

            if (activeDragConnection) {
                viewport.classList.remove('connecting');

                // Find input port under cursor
                const el = document.elementFromPoint(e.clientX, e.clientY);
                const targetPort = el ? el.closest('.node-port.port-in') : null;

                if (targetPort) {
                    const toNodeId = targetPort.getAttribute('data-node-id');
                    const toPort = targetPort.getAttribute('data-port-type'); // 'teamA' or 'teamB'

                    // Avoid self-connections
                    if (toNodeId !== activeDragConnection.fromNodeId) {
                        // Remove existing connection to this specific target input port
                        connections = connections.filter(c => !(c.toNodeId === toNodeId && c.toPort === toPort));

                        // Add new connection
                        connections.push({
                            fromNodeId: activeDragConnection.fromNodeId,
                            fromPort: activeDragConnection.fromPort,
                            toNodeId: toNodeId,
                            toPort: toPort
                        });

                        evaluateBracket();
                    }
                }

                // Cleanup temp line
                activeDragConnection = null;
                const tempPath = document.getElementById('temp-bracket-path');
                if (tempPath) tempPath.remove();

                drawConnections();
            }
        });

        // Zoom Scroll Events
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = 1.08;
            let newZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
            newZoom = Math.max(0.3, Math.min(2.5, newZoom));

            const rect = viewport.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Maintain focus relative to mouse cursor
            const canvasX = (mouseX - pan.x) / zoom;
            const canvasY = (mouseY - pan.y) / zoom;

            zoom = newZoom;
            pan.x = mouseX - canvasX * zoom;
            pan.y = mouseY - canvasY * zoom;

            updateCanvasTransform();
        });
    }

    // Apply translation and scaling to canvas
    function updateCanvasTransform() {
        const canvas = document.getElementById('bracket-canvas');
        if (canvas) {
            canvas.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
        }
    }

    // Add Seeding Team node
    function addSeedNode() {
        const nodeId = 'node_seed_' + Date.now() + '_' + Math.floor(Math.random() * 100);
        const node = {
            id: nodeId,
            type: 'seed',
            x: 150 - pan.x / zoom + Math.random() * 80,
            y: 150 - pan.y / zoom + Math.random() * 80,
            teamAName: 'Đội hạt giống'
        };

        nodes.push(node);
        renderNodeDOM(node);
        evaluateBracket();
        drawConnections();
    }

    // Add Match history node
    function addMatchNode(saveId = null) {
        const nodeId = 'node_match_' + Date.now() + '_' + Math.floor(Math.random() * 100);
        const node = {
            id: nodeId,
            type: 'match',
            saveId: saveId,
            x: 200 - pan.x / zoom + Math.random() * 80,
            y: 150 - pan.y / zoom + Math.random() * 80,
            computedTeamA: '',
            computedTeamB: ''
        };

        nodes.push(node);
        renderNodeDOM(node);
        evaluateBracket();
        drawConnections();
    }

    // Add Region/Zone node (activate click-and-drag drawing mode)
    function addRegionNode() {
        isDrawRegionMode = true;
        const viewport = document.getElementById('bracket-canvas-viewport');
        if (viewport) {
            viewport.style.cursor = 'crosshair';
            showToast('Nhấp và kéo chuột trên bản đồ để vẽ vùng nền mới!', 'success');
        }
    }

    // Update Region text
    function updateRegionNodeText(nodeId, val) {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            node.text = val;
        }
    }

    function hexToRgb(hex) {
        if (!hex) return '0, 245, 255';
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 245, 255';
    }

    // Update Region background color theme using color picker
    function updateRegionColor(nodeId, colorHex) {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        node.colorHex = colorHex;

        // Update DOM element directly
        const el = document.getElementById(nodeId);
        if (el) {
            el.style.setProperty('--region-color', colorHex);
            el.style.setProperty('--region-color-rgb', hexToRgb(colorHex));
        }
    }

    // Snap alignment guides
    function showGuideLine(id, coord, isVertical) {
        let guide = document.getElementById(id);
        if (!guide) {
            guide = document.createElement('div');
            guide.id = id;
            guide.style.position = 'absolute';
            guide.style.pointerEvents = 'none';
            guide.style.border = '1px dashed var(--accent)';
            guide.style.boxShadow = '0 0 10px rgba(0, 245, 255, 0.4)';
            guide.style.zIndex = '5';
            const canvas = document.getElementById('bracket-canvas');
            if (canvas) canvas.appendChild(guide);
        }
        if (isVertical) {
            guide.style.left = coord + 'px';
            guide.style.top = '0px';
            guide.style.width = '0px';
            guide.style.height = '5000px';
        } else {
            guide.style.left = '0px';
            guide.style.top = coord + 'px';
            guide.style.width = '5000px';
            guide.style.height = '0px';
        }
        guide.style.display = 'block';
    }

    function hideGuideLine(id) {
        const guide = document.getElementById(id);
        if (guide) {
            guide.style.display = 'none';
        }
    }

    // Render node DOM element
    function renderNodeDOM(node) {
        const container = document.getElementById('bracket-nodes-container');
        if (!container) return;

        const nodeEl = document.createElement('div');
        nodeEl.id = node.id;
        nodeEl.style.left = node.x + 'px';
        nodeEl.style.top = node.y + 'px';

        if (node.type === 'region') {
            // Map legacy bgColor if colorHex is missing
            if (!node.colorHex) {
                const colorMap = {
                    cyan: '#00f5ff',
                    green: '#10b981',
                    red: '#ef4444',
                    purple: '#8b5cf6',
                    grey: '#e2e8f0'
                };
                node.colorHex = colorMap[node.bgColor] || '#00f5ff';
            }

            nodeEl.className = 'bracket-node region-node';
            nodeEl.style.width = (node.width || 320) + 'px';
            nodeEl.style.height = (node.height || 220) + 'px';
            nodeEl.style.setProperty('--region-color', node.colorHex);
            nodeEl.style.setProperty('--region-color-rgb', hexToRgb(node.colorHex));
            nodeEl.innerHTML = `
                <div class="node-header">
                    <span>Khung Vùng / Vòng Đấu</span>
                    <div style="display: flex; gap: 4px; align-items: center; margin-left: auto;">
                        <div style="position: relative; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;">
                            <input type="color" class="node-color-input" value="${node.colorHex}" oninput="updateRegionColor('${node.id}', this.value)" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; padding: 0; border: none; z-index: 2;">
                            <button class="node-palette-btn" style="pointer-events: none; position: relative; z-index: 1;" title="Thay đổi màu nền"><i class="fas fa-palette"></i></button>
                        </div>
                        <button class="node-delete-btn" onclick="deleteBracketNode('${node.id}')" title="Xóa vùng này"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="node-body">
                    <input type="text" class="node-label-input" value="${node.text || ''}" placeholder="Tên khu vực..." oninput="updateRegionNodeText('${node.id}', this.value)">
                    <div class="region-resize-handle" title="Kéo góc này để thay đổi kích thước"></div>
                </div>
            `;
        } else if (node.type === 'seed') {
            nodeEl.className = 'bracket-node';
            const teamA = node.computedTeamA || node.teamAName || 'Đội hạt giống';
            const isLinked = !!node.computedTeamA;

            nodeEl.innerHTML = `
                <div class="node-header">
                    <span>Hạt Giống / Đội</span>
                    <button class="node-delete-btn" onclick="deleteBracketNode('${node.id}')" style="margin-left: auto;"><i class="fas fa-times"></i></button>
                </div>
                <div class="node-body">
                    <div class="node-team-row" style="position: relative; background: transparent; padding: 0; border: none;">
                        <div class="node-port port-in" data-node-id="${node.id}" data-port-type="teamA" title="Nối đội từ trận đấu khác"></div>
                        <input type="text" class="node-seed-input" value="${teamA}" placeholder="Tên đội..." oninput="updateSeedNodeText('${node.id}', this.value)" ${isLinked ? 'readonly style="opacity:0.75; cursor:not-allowed;"' : ''}>
                        <div class="node-port port-out" data-node-id="${node.id}" data-port-type="winner" title="Kéo để nối đội này thắng"></div>
                    </div>
                </div>
            `;
        } else {
            nodeEl.className = 'bracket-node';
            const save = savedMatches.find(s => s.id === node.saveId);
            const teamA = node.computedTeamA || save?.score?.teamA?.name || 'TEAM A';
            const teamB = node.computedTeamB || save?.score?.teamB?.name || 'TEAM B';
            const scoreA = save?.score?.teamA?.score ?? 0;
            const scoreB = save?.score?.teamB?.score ?? 0;
            const winner = scoreA > scoreB ? teamA : (scoreB > scoreA ? teamB : '');
            const loser = scoreA > scoreB ? teamB : (scoreB > scoreA ? teamA : '');

            // Generate selector button HTML if no saveId is bound
            let selectHTML = '';
            if (!node.saveId) {
                selectHTML = `
                    <div style="padding: 2px 4px 6px 4px;">
                        <button class="btn-history-load" onclick="openBracketSelectModal('${node.id}')" style="width: 100%; font-size: 11px; padding: 6px 10px; background: rgba(0, 245, 255, 0.08); border: 1px solid rgba(0, 245, 255, 0.2); color: var(--accent);">
                            <i class="fas fa-link"></i> Chọn Trận Đấu
                        </button>
                    </div>
                `;
            }

            // Header edit button to change match
            let editBtnHTML = '';
            if (node.saveId) {
                editBtnHTML = `<button class="node-palette-btn" onclick="openBracketSelectModal('${node.id}')" title="Chọn trận đấu khác" style="margin-right: 6px; display: inline-flex; align-items: center; justify-content: center;"><i class="fas fa-edit"></i></button>`;
            }

            nodeEl.innerHTML = `
                <div class="node-header">
                    <span title="${save?.tournament?.bracketLabel || 'CHƯA GÁN TRẬN'}">${save?.tournament?.bracketLabel || 'CHƯA GÁN TRẬN'}</span>
                    <div style="display: flex; gap: 4px; align-items: center; margin-left: auto;">
                        ${editBtnHTML}
                        <button class="node-delete-btn" onclick="deleteBracketNode('${node.id}')"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <div class="node-body">
                    ${selectHTML}
                    <div class="node-team-row ${node.saveId && scoreA > scoreB ? 'winner' : ''}" style="position: relative;">
                        <div class="node-port port-in" data-node-id="${node.id}" data-port-type="teamA" title="Nối đội thắng/thua từ trận khác"></div>
                        <span class="node-team-name" title="${teamA}">${teamA}</span>
                        <span class="node-team-score">${node.saveId ? scoreA : '-'}</span>
                    </div>
                    <div class="node-team-row ${node.saveId && scoreB > scoreA ? 'winner' : ''}" style="position: relative;">
                        <div class="node-port port-in" data-node-id="${node.id}" data-port-type="teamB" title="Nối đội thắng/thua từ trận khác"></div>
                        <span class="node-team-name" title="${teamB}">${teamB}</span>
                        <span class="node-team-score">${node.saveId ? scoreB : '-'}</span>
                    </div>
                    <div class="node-winner-row" style="margin-top: 6px; display: flex; align-items: center; justify-content: space-between; position: relative;">
                        <span>Thắng: <span class="node-winner-name" style="font-weight: bold; color: var(--accent);">${node.saveId ? (winner || 'Chưa định đoạt') : 'Chưa gán trận'}</span></span>
                        <div class="node-port port-out winner-port" data-node-id="${node.id}" data-port-type="winner" title="Kéo kết quả ĐỘI THẮNG" style="position: absolute; right: -8px; top: 50%; transform: translateY(-50%);"></div>
                    </div>
                    <div class="node-loser-row" style="margin-top: 4px; display: flex; align-items: center; justify-content: space-between; position: relative;">
                        <span>Thua: <span class="node-loser-name" style="color: var(--text-dim);">${node.saveId ? (loser || 'Chưa định đoạt') : 'Chưa gán trận'}</span></span>
                        <div class="node-port port-out loser-port" data-node-id="${node.id}" data-port-type="loser" title="Kéo kết quả ĐỘI THUA" style="position: absolute; right: -8px; top: 50%; transform: translateY(-50%);"></div>
                    </div>
                </div>
            `;
        }

        // Attach dragging listener on header
        const header = nodeEl.querySelector('.node-header');
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.node-delete-btn') || e.target.closest('.node-palette-btn') || e.target.closest('input')) return;
            e.stopPropagation();

            nodeEl.classList.add('dragging');
            const startX = e.clientX;
            const startY = e.clientY;
            const initialLeft = node.x;
            const initialTop = node.y;

            function onMouseMove(mEv) {
                const dx = (mEv.clientX - startX) / zoom;
                const dy = (mEv.clientY - startY) / zoom;

                let targetX = initialLeft + dx;
                let targetY = initialTop + dy;

                let snapX = null;
                let snapY = null;
                const snapTolerance = 10; // Snap proximity threshold

                for (let other of nodes) {
                    if (other.id === node.id) continue;

                    // Snap Horizontally (align X with neighbor)
                    if (Math.abs(targetX - other.x) < snapTolerance) {
                        snapX = other.x;
                    }
                    // Snap Vertically (align Y with neighbor)
                    if (Math.abs(targetY - other.y) < snapTolerance) {
                        snapY = other.y;
                    }
                }

                if (snapX !== null) {
                    targetX = snapX;
                    showGuideLine('v-guide', targetX, true);
                } else {
                    hideGuideLine('v-guide');
                }

                if (snapY !== null) {
                    targetY = snapY;
                    showGuideLine('h-guide', targetY, false);
                } else {
                    hideGuideLine('h-guide');
                }

                node.x = targetX;
                node.y = targetY;

                nodeEl.style.left = node.x + 'px';
                nodeEl.style.top = node.y + 'px';

                drawConnections();
            }

            function onMouseUp() {
                nodeEl.classList.remove('dragging');
                hideGuideLine('v-guide');
                hideGuideLine('h-guide');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // Attach resize handle listener for region nodes
        const resizeHandle = nodeEl.querySelector('.region-resize-handle');
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();

                const startX = e.clientX;
                const startY = e.clientY;
                const startW = node.width || 320;
                const startH = node.height || 220;

                function onMouseMoveResize(mEv) {
                    const dw = (mEv.clientX - startX) / zoom;
                    const dh = (mEv.clientY - startY) / zoom;

                    node.width = Math.max(160, startW + dw);
                    node.height = Math.max(80, startH + dh);

                    nodeEl.style.width = node.width + 'px';
                    nodeEl.style.height = node.height + 'px';

                    drawConnections();
                }

                function onMouseUpResize() {
                    document.removeEventListener('mousemove', onMouseMoveResize);
                    document.removeEventListener('mouseup', onMouseUpResize);
                }

                document.addEventListener('mousemove', onMouseMoveResize);
                document.addEventListener('mouseup', onMouseUpResize);
            });
        }

        // Attach port click-and-drag listeners to all output ports
        nodeEl.querySelectorAll('.node-port.port-out').forEach(outPort => {
            outPort.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();

                const portType = outPort.getAttribute('data-port-type'); // 'winner' or 'loser'
                const coords = getPortCoordinates(node.id, portType);
                if (!coords) return;

                activeDragConnection = {
                    fromNodeId: node.id,
                    fromPort: portType,
                    startX: coords.x,
                    startY: coords.y
                };

                document.getElementById('bracket-canvas-viewport').classList.add('connecting');
            });
        });

        container.appendChild(nodeEl);
    }

    // Delete node
    async function deleteBracketNode(nodeId) {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        let nodeName = "đối tượng này";
        if (node.type === 'seed') {
            nodeName = `Đội hạt giống "${node.teamAName || 'Chưa đặt tên'}"`;
        } else if (node.type === 'region') {
            nodeName = `Vùng nền "${node.text || 'Chưa đặt tên'}"`;
        } else if (node.type === 'match') {
            const save = savedMatches.find(s => s.id === node.saveId);
            const teamA = node.computedTeamA || save?.score?.teamA?.name || 'TEAM A';
            const teamB = node.computedTeamB || save?.score?.teamB?.name || 'TEAM B';
            nodeName = `Cặp trận "${teamA} vs ${teamB}"`;
        }

        const confirmed = await showConfirm(
            "Xóa Đối Tượng Sơ Đồ",
            `Bạn có chắc chắn muốn xóa ${nodeName}? Hành động này cũng sẽ xóa các kết nối liên quan.`
        );
        if (!confirmed) return;

        nodes = nodes.filter(n => n.id !== nodeId);
        connections = connections.filter(c => c.fromNodeId !== nodeId && c.toNodeId !== nodeId);

        const el = document.getElementById(nodeId);
        if (el) el.remove();

        evaluateBracket();
        drawConnections();
    }

    // Update manual text inputs of seed node
    function updateSeedNodeText(nodeId, val) {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            node.teamAName = val;
            evaluateBracket();
        }
    }

    // Evaluate/propagate winner and loser names downstream
    function evaluateBracket() {
        const iterations = 6;
        for (let i = 0; i < iterations; i++) {
            // First clear computer values of match and seed nodes
            nodes.forEach(node => {
                if (node.type === 'match') {
                    node.computedTeamA = '';
                    node.computedTeamB = '';
                } else if (node.type === 'seed') {
                    node.computedTeamA = '';
                }
            });

            // Map connection values
            connections.forEach(conn => {
                const sourceNode = nodes.find(n => n.id === conn.fromNodeId);
                const targetNode = nodes.find(n => n.id === conn.toNodeId);
                if (!sourceNode || !targetNode) return;

                let val = '';
                if (sourceNode.type === 'seed') {
                    // Seed node propagates its current name (either manual or computed from upstream)
                    val = sourceNode.computedTeamA || sourceNode.teamAName || '';
                } else if (sourceNode.type === 'match') {
                    const save = savedMatches.find(s => s.id === sourceNode.saveId);
                    const teamA = sourceNode.computedTeamA || save?.score?.teamA?.name || 'TEAM A';
                    const teamB = sourceNode.computedTeamB || save?.score?.teamB?.name || 'TEAM B';
                    const scoreA = save?.score?.teamA?.score ?? 0;
                    const scoreB = save?.score?.teamB?.score ?? 0;

                    const winner = scoreA > scoreB ? teamA : (scoreB > scoreA ? teamB : '');
                    const loser = scoreA > scoreB ? teamB : (scoreB > scoreA ? teamA : '');

                    val = conn.fromPort === 'loser' ? loser : winner;
                }

                // Inject winner or loser into target input slot
                if (conn.toPort === 'teamA') {
                    targetNode.computedTeamA = val;
                } else if (conn.toPort === 'teamB') {
                    targetNode.computedTeamB = val;
                }
            });
        }

        // Re-render text & style changes to DOM nodes without fully destroying them
        nodes.forEach(node => {
            const el = document.getElementById(node.id);
            if (!el) return;

            if (node.type === 'seed') {
                const teamA = node.computedTeamA || node.teamAName || '';
                const input = el.querySelector('.node-seed-input');
                if (input) {
                    input.value = teamA;
                    if (node.computedTeamA) {
                        input.setAttribute('readonly', 'true');
                        input.style.opacity = '0.75';
                        input.style.cursor = 'not-allowed';
                    } else {
                        input.removeAttribute('readonly');
                        input.style.opacity = '';
                        input.style.cursor = '';
                    }
                }
            } else if (node.type === 'match') {
                const save = savedMatches.find(s => s.id === node.saveId);
                const teamA = node.computedTeamA || save?.score?.teamA?.name || 'TEAM A';
                const teamB = node.computedTeamB || save?.score?.teamB?.name || 'TEAM B';
                const scoreA = save?.score?.teamA?.score ?? 0;
                const scoreB = save?.score?.teamB?.score ?? 0;
                const winnerName = scoreA > scoreB ? teamA : (scoreB > scoreA ? teamB : '');
                const loserName = scoreA > scoreB ? teamB : (scoreB > scoreA ? teamA : '');

                const teamRows = el.querySelectorAll('.node-team-row');
                if (teamRows.length === 2) {
                    teamRows[0].className = `node-team-row ${node.saveId && scoreA > scoreB ? 'winner' : ''}`;
                    teamRows[0].querySelector('.node-team-name').textContent = teamA;
                    teamRows[0].querySelector('.node-team-name').setAttribute('title', teamA);
                    teamRows[0].querySelector('.node-team-score').textContent = node.saveId ? scoreA : '-';

                    teamRows[1].className = `node-team-row ${node.saveId && scoreB > scoreA ? 'winner' : ''}`;
                    teamRows[1].querySelector('.node-team-name').textContent = teamB;
                    teamRows[1].querySelector('.node-team-name').setAttribute('title', teamB);
                    teamRows[1].querySelector('.node-team-score').textContent = node.saveId ? scoreB : '-';
                }

                const winLabel = el.querySelector('.node-winner-name');
                if (winLabel) {
                    winLabel.textContent = node.saveId ? (winnerName || 'Chưa định đoạt') : 'Chưa gán trận';
                }
                const loseLabel = el.querySelector('.node-loser-name');
                if (loseLabel) {
                    loseLabel.textContent = node.saveId ? (loserName || 'Chưa định đoạt') : 'Chưa gán trận';
                }
            }
        });

        // Set connected class on ports dynamically
        document.querySelectorAll('.node-port.port-in').forEach(port => {
            const nodeId = port.getAttribute('data-node-id');
            const portType = port.getAttribute('data-port-type');
            const isConnected = connections.some(c => c.toNodeId === nodeId && c.toPort === portType);
            port.classList.toggle('connected', isConnected);
        });
    }

    // Get port centers coordinates relative to canvas element
    function getPortCoordinates(nodeId, portType) {
        const nodeEl = document.getElementById(nodeId);
        const canvas = document.getElementById('bracket-canvas');
        if (!nodeEl || !canvas) return null;

        const portEl = nodeEl.querySelector(`[data-port-type="${portType}"]`);
        if (!portEl) return null;

        const canvasRect = canvas.getBoundingClientRect();
        const portRect = portEl.getBoundingClientRect();

        return {
            x: (portRect.left + portRect.width / 2 - canvasRect.left) / zoom,
            y: (portRect.top + portRect.height / 2 - canvasRect.top) / zoom
        };
    }

    // Draw SVG connections
    function drawConnections() {
        const svgLayer = document.getElementById('bracket-svg-layer');
        if (!svgLayer) return;

        // Clear existing curves (connection groups)
        const groups = svgLayer.querySelectorAll('.connection-group');
        groups.forEach(g => g.remove());

        connections.forEach((conn, index) => {
            const p1 = getPortCoordinates(conn.fromNodeId, conn.fromPort || 'winner');
            const p2 = getPortCoordinates(conn.toNodeId, conn.toPort);

            if (p1 && p2) {
                const groupEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                groupEl.setAttribute('class', 'connection-group');

                const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathEl.setAttribute('class', 'bracket-svg-path');

                const dx = Math.abs(p2.x - p1.x) * 0.55;
                const pathString = `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;

                pathEl.setAttribute('d', pathString);

                // Create a wider invisible interaction helper path for easy hover
                const helperPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                helperPath.setAttribute('d', pathString);
                helperPath.setAttribute('fill', 'none');
                helperPath.setAttribute('stroke', 'transparent');
                helperPath.setAttribute('stroke-width', '12');
                helperPath.setAttribute('cursor', 'pointer');
                helperPath.style.pointerEvents = 'stroke';

                // Create delete button group
                const deleteBtn = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                deleteBtn.setAttribute('class', 'connection-delete-btn');
                deleteBtn.style.opacity = '0';
                deleteBtn.style.transition = 'opacity 0.15s';
                deleteBtn.style.cursor = 'pointer';
                deleteBtn.style.pointerEvents = 'auto';

                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('r', '8');
                circle.setAttribute('fill', '#ef4444');
                circle.setAttribute('stroke', '#ffffff');
                circle.setAttribute('stroke-width', '1');

                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.textContent = '×';
                text.setAttribute('font-size', '12');
                text.setAttribute('font-weight', 'bold');
                text.setAttribute('fill', '#ffffff');
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('dy', '3.5');

                deleteBtn.appendChild(circle);
                deleteBtn.appendChild(text);

                groupEl.appendChild(pathEl);
                groupEl.appendChild(helperPath);
                groupEl.appendChild(deleteBtn);
                svgLayer.appendChild(groupEl);

                // Position the delete button at the midpoint
                try {
                    const totalLength = pathEl.getTotalLength();
                    const midPoint = pathEl.getPointAtLength(totalLength / 2);
                    deleteBtn.setAttribute('transform', `translate(${midPoint.x}, ${midPoint.y})`);
                } catch (e) {
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;
                    deleteBtn.setAttribute('transform', `translate(${midX}, ${midY})`);
                }

                // Show delete button on hovering the group
                groupEl.addEventListener('mouseenter', () => {
                    deleteBtn.style.opacity = '1';
                    pathEl.style.stroke = '#ff2a2a';
                    pathEl.style.strokeWidth = '3.5px';
                });

                groupEl.addEventListener('mouseleave', () => {
                    deleteBtn.style.opacity = '0';
                    pathEl.style.stroke = '';
                    pathEl.style.strokeWidth = '';
                });

                // Clicking the delete button deletes the connection
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    connections.splice(index, 1);
                    evaluateBracket();
                    drawConnections();
                });
            }
        });
    }

    // Draw temporary dragging connection curve
    function drawTempConnection(startX, startY, endX, endY) {
        const svgLayer = document.getElementById('bracket-svg-layer');
        if (!svgLayer) return;

        let tempPath = document.getElementById('temp-bracket-path');
        if (!tempPath) {
            tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            tempPath.id = 'temp-bracket-path';
            tempPath.style.fill = 'none';
            tempPath.style.stroke = 'var(--accent)';
            tempPath.style.strokeWidth = '2px';
            tempPath.style.strokeDasharray = '5,5';
            svgLayer.appendChild(tempPath);
        }

        const dx = Math.abs(endX - startX) * 0.55;
        const pathString = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
        tempPath.setAttribute('d', pathString);
    }

    // HUD Button Zoom controls
    function zoomBracket(delta) {
        zoom = Math.max(0.3, Math.min(2.5, zoom + delta));
        updateCanvasTransform();
    }

    // HUD Button Reset View controls
    function resetBracketView() {
        zoom = 1.0;
        pan = { x: 100, y: 100 };
        updateCanvasTransform();
    }

    // HUD Button grid controls
    function toggleBracketGrid() {
        const canvas = document.getElementById('bracket-canvas');
        const btn = document.getElementById('btn-toggle-grid');
        if (canvas && btn) {
            const hasGrid = canvas.classList.contains('grid-bg');
            canvas.classList.toggle('grid-bg', !hasGrid);
            btn.classList.toggle('active', !hasGrid);
        }
    }

    // Load Bracket configuration from server
    async function loadBracketFromServer() {
        try {
            const res = await fetch('/api/bracket');
            if (!res.ok) throw new Error('API error');
            const data = await res.json();

            nodes = data.nodes || [];
            connections = data.connections || [];
            pan = data.panZoom || { x: 100, y: 100 };
            zoom = data.zoom || 1.0;

            // Rebuild Node elements in DOM
            const container = document.getElementById('bracket-nodes-container');
            if (container) container.innerHTML = '';

            nodes.forEach(node => renderNodeDOM(node));
            evaluateBracket();

            // 1. Apply transform first so layout is scaled correctly
            updateCanvasTransform();

            // 2. Defer connection drawing to let the browser complete its layout reflow first
            setTimeout(() => {
                drawConnections();
            }, 100);
        } catch (e) {
            console.error('Lỗi tải sơ đồ:', e.message);
        }
    }

    // Save Bracket configuration to server
    async function saveBracketConfig() {
        try {
            const payload = {
                nodes: nodes,
                connections: connections,
                panZoom: pan,
                zoom: zoom
            };

            const res = await fetch('/api/bracket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showToast('✓ Đã lưu sơ đồ giải đấu thành công!', 'success');
            } else {
                showToast('Lỗi lưu sơ đồ giải đấu!', 'error');
            }
        } catch (e) {
            showToast('Lỗi kết nối máy chủ: ' + e.message, 'error');
        }
    }

    // Clear all configuration
    async function clearBracketConfig() {
        const confirmed = await showConfirm(
            "Xóa Sơ Đồ",
            "Bạn có chắc chắn muốn xóa hoàn toàn các node và liên kết của sơ đồ giải đấu hiện tại?"
        );
        if (!confirmed) return;

        nodes = [];
        connections = [];
        const container = document.getElementById('bracket-nodes-container');
        if (container) container.innerHTML = '';
        drawConnections();
        showToast('Đã dọn sạch sơ đồ.', 'success');
    }

    function toggleHudCollapse() {
        const hud = document.getElementById('bracket-hud');
        if (hud) {
            hud.classList.toggle('collapsed');
        }
    }

    function copyPublicBracketLink() {
        let roomId = 'room_1';
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const parts = token.split('-');
                if (parts.length >= 3 && parts[0] === 'kdone' && parts[1] === 'token') {
                    roomId = 'room_' + parts[2];
                }
            }
        } catch (e) { }

        const publicUrl = `${window.location.origin}/bracket-view?roomId=${roomId}`;
        navigator.clipboard.writeText(publicUrl).then(() => {
            showToast('✓ Đã sao chép link chia sẻ công khai vào clipboard!', 'success');
        }).catch(err => {
            showToast('Không thể sao chép tự động. Vui lòng copy: ' + publicUrl, 'error');
        });
    }

    // Bind bracket editor helpers to window
    window.switchHistorySubTab = switchHistorySubTab;
    window.addSeedNode = addSeedNode;
    window.addMatchNode = addMatchNode;
    window.toggleHudCollapse = toggleHudCollapse;
    window.copyPublicBracketLink = copyPublicBracketLink;
    window.addRegionNode = addRegionNode;
    window.updateRegionColor = updateRegionColor;
    window.deleteBracketNode = deleteBracketNode;
    window.updateSeedNodeText = updateSeedNodeText;
    window.updateRegionNodeText = updateRegionNodeText;
    window.zoomBracket = zoomBracket;
    window.resetBracketView = resetBracketView;
    window.toggleBracketGrid = toggleBracketGrid;
    window.saveBracketConfig = saveBracketConfig;
    window.clearBracketConfig = clearBracketConfig;

    // Initialize immediately
    const searchInput = document.getElementById('hist-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', renderHistory);
    }
    const sortSelect = document.getElementById('hist-sort-order');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            renderHistory();
            renderBracketSidebarMatches();
        });
    }
    const bracketFilterSelect = document.getElementById('hist-bracket-filter');
    if (bracketFilterSelect) {
        bracketFilterSelect.addEventListener('change', renderHistory);
    }
    loadData();
})();


