(() => {
    const WEAPON_MAP = {
        1: "Broadblade",
        2: "Sword",
        3: "Pistols",
        4: "Gauntlets",
        5: "Rectifier",
    };

    const R_KEYS = ["r1", "r2", "r3", "r4", "r5"];
    let weapons = [];
    let filterType = 0;
    let filterRank = 0;
    let searchQuery = "";

    let currentPage = 1;
    const itemsPerPage = 20;

    // Elements prefixed with wp-
    const tableBody = document.getElementById('wp-table-body');
    const emptyMessage = document.getElementById('wp-empty-message');
    const searchInput = document.getElementById('wp-search-input');
    const typeFiltersContainer = document.getElementById('wp-type-filters');
    const rankFiltersContainer = document.getElementById('wp-rank-filters');
    const resetBtn = document.getElementById('wp-reset-btn');
    const saveServerBtn = document.getElementById('wp-save-server-btn');
    const exportBtn = document.getElementById('wp-export-btn');
    const statsSummary = document.getElementById('wp-stats-summary');
    const footerStats = document.getElementById('wp-footer-stats');
    const prevPageBtn = document.getElementById('wp-prev-page');
    const nextPageBtn = document.getElementById('wp-next-page');
    const pageDisplay = document.getElementById('wp-page-display');
    const paginationControls = document.getElementById('wp-pagination-controls');

    // Initialize filters
    function initFilters() {
        if (!typeFiltersContainer || !rankFiltersContainer) return;

        typeFiltersContainer.querySelectorAll('.filter-btn').forEach(btn => {
            btn.onclick = (e) => {
                filterType = parseInt(btn.dataset.type);
                currentPage = 1;
                updateFilterButtons('type', btn);
                render();
            };
        });

        rankFiltersContainer.querySelectorAll('.filter-btn').forEach(btn => {
            btn.onclick = () => {
                filterRank = parseInt(btn.dataset.rank);
                currentPage = 1;
                updateFilterButtons('rank', btn);
                render();
            };
        });
    }

    function updateFilterButtons(type, activeBtn) {
        const container = type === 'type' ? typeFiltersContainer : rankFiltersContainer;
        if (container) {
            container.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            activeBtn.classList.add('active');
        }
    }

    async function initApp() {
        try {
            const res = await fetch('/api/weapons');
            const data = await res.json();
            weapons = data.sort((a, b) => {
                const rankDiff = (b.rank || 0) - (a.rank || 0);
                if (rankDiff !== 0) return rankDiff;
                return (a.name || '').localeCompare(b.name || '', 'vi');
            });
            initFilters();
            render();
        } catch (e) {
            console.error("Failed to load weapons:", e);
            if (statsSummary) statsSummary.textContent = "Error loading data from server.";
        }
    }

    function getFilteredWeapons() {
        return weapons.filter(w => {
            const matchSearch = w.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchType = filterType === 0 || w.typeid === filterType;
            const matchRank = filterRank === 0 || w.rank === filterRank;
            return matchSearch && matchType && matchRank;
        });
    }

    function render() {
        if (!tableBody) return;
        const filtered = getFilteredWeapons();

        const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
        if (currentPage > totalPages) currentPage = totalPages;

        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const paginated = filtered.slice(start, end);

        tableBody.innerHTML = '';

        if (filtered.length === 0) {
            if (emptyMessage) emptyMessage.style.display = 'block';
            if (paginationControls) paginationControls.style.display = 'none';
        } else {
            if (emptyMessage) emptyMessage.style.display = 'none';
            if (paginationControls) paginationControls.style.display = 'flex';
            paginated.forEach(w => {
                const tr = document.createElement('tr');

                let rCells = '';
                R_KEYS.forEach(key => {
                    rCells += `
                        <td class="text-center">
                            <input type="text" 
                                   class="rc-input ${w[key] > 0 ? 'has-value' : ''}" 
                                   value="${w[key]}" 
                                   inputmode="numeric"
                                   onfocus="this.select()"
                                   oninput="updateR(${w.id}, '${key}', this.value)">
                        </td>
                    `;
                });

                // Weapon Image fallback to dynamic placeholder or default
                const imgPath = w.imagebig || w.image || 'images/weapons/placeholder.png';

                tr.innerHTML = `
                    <td class="text-center" style="color: var(--text-dim)">${w.id}</td>
                    <td class="text-center">
                        <div class="wp-img-preview" style="background-image: url('${imgPath}'); width: 40px; height: 40px; background-size: cover; background-position: center; border-radius: 4px; margin: 0 auto; background-color: #222;"></div>
                    </td>
                    <td style="font-weight: 600">${w.name}</td>
                    <td class="text-center">
                        <span class="rank${w.rank}">${w.rank}★</span>
                    </td>
                    <td style="color: var(--text-dim)">${WEAPON_MAP[w.typeid]}</td>
                    ${rCells}
                    <td class="text-center">
                        <input type="checkbox" ${w.isActive ? 'checked' : ''} onchange="toggleWpActive(${w.id})" style="transform: scale(1.2); cursor: pointer; accent-color: var(--accent);">
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        }

        // Update stats
        const total = weapons.length;
        const count = filtered.length;
        if (statsSummary) statsSummary.textContent = `${total} weapons | Click Active để bật/tắt`;
        if (footerStats) footerStats.textContent = `Total: ${total} | Filtered: ${count}`;

        // Update pagination UI
        if (pageDisplay) pageDisplay.textContent = `Page ${currentPage} of ${totalPages}`;
        if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
        if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;

        // Apply non-admin restrictions to Reset and Save buttons
        const isAdmin = localStorage.getItem('kdone_is_admin') === 'true';
        if (!isAdmin) {
            if (resetBtn) {
                resetBtn.style.opacity = '0.35';
                resetBtn.style.pointerEvents = 'none';
                resetBtn.disabled = true;
            }
            if (saveServerBtn) {
                saveServerBtn.style.opacity = '0.35';
                saveServerBtn.style.pointerEvents = 'none';
                saveServerBtn.disabled = true;
            }
        }
    }

    if (prevPageBtn) {
        prevPageBtn.onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                render();
                const container = document.querySelector('#tab-weapon-editor .table-container');
                if (container) container.scrollTop = 0;
            }
        };
    }

    if (nextPageBtn) {
        nextPageBtn.onclick = () => {
            const filtered = getFilteredWeapons();
            const totalPages = Math.ceil(filtered.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                render();
                const container = document.querySelector('#tab-weapon-editor .table-container');
                if (container) container.scrollTop = 0;
            }
        };
    }

    // Logic Functions
    window.updateR = (id, key, value) => {
        const stripped = String(value).replace(/[^0-9]/g, "");
        const num = stripped === "" ? 0 : Math.min(50000, parseInt(stripped, 10));
        const wpIndex = weapons.findIndex(w => w.id === id);
        if (wpIndex !== -1) {
            weapons[wpIndex][key] = isNaN(num) ? 0 : num;
            // Update specific input style without full re-render for performance
            const input = document.activeElement;
            if (input && input.classList.contains('rc-input') && !input.style.width) {
                if (num > 0) input.classList.add('has-value');
                else input.classList.remove('has-value');
            }
        }
    };

    window.toggleWpActive = (id) => {
        const wpIndex = weapons.findIndex(w => w.id === id);
        if (wpIndex !== -1) {
            weapons[wpIndex].isActive = !weapons[wpIndex].isActive;
            render();
        }
    };

    if (resetBtn) {
        resetBtn.onclick = async () => {
            const confirmed = await showConfirm("Reset Weapon Values", "Bạn có chắc chắn muốn reset toàn bộ giá trị R1-R5 về 0?");
            if (confirmed) {
                weapons.forEach(w => {
                    R_KEYS.forEach(key => w[key] = 0);
                });
                render();
            }
        };
    }

    if (saveServerBtn) {
        saveServerBtn.onclick = async () => {
            try {
                const res = await fetch('/api/weapons', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(weapons)
                });
                if (res.ok) {
                    showToast("✓ Data Saved to Server!", "success");
                } else {
                    showToast("Failed to save data to server.", "error");
                }
            } catch (e) {
                console.error(e);
                showToast("Error connecting to server.", "error");
            }
        };
    }

    if (exportBtn) {
        exportBtn.onclick = () => {
            const blob = new Blob([JSON.stringify(weapons, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "weapon_updated.json";
            a.click();
            URL.revokeObjectURL(url);
            showToast("✓ JSON Exported Successfully!", "success");
        };
    }

    if (searchInput) {
        searchInput.oninput = (e) => {
            searchQuery = e.target.value;
            currentPage = 1;
            render();
        };
    }

    // Start
    window.refreshWeaponEditor = initApp;
    initApp();
})();
