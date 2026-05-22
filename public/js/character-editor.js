(() => {
    const ELEMENT_MAP = {
        0: { name: "Multi", color: "#ffffff", bg: "linear-gradient(90deg, #7affd4 0%, #ffe168 50%, #e05cff 100%)" },
        1: { name: "Glacio", color: "#7ecfef", bg: "#0e2a3a" },
        2: { name: "Fusion", color: "#f97c4f", bg: "#3a1a0a" },
        3: { name: "Electro", color: "#b98fff", bg: "#1e1040" },
        4: { name: "Aero", color: "#7affd4", bg: "#0a2a22" },
        5: { name: "Spectro", color: "#ffe168", bg: "#2a2400" },
        6: { name: "Havoc", color: "#e05cff", bg: "#250a2a" },
    };

    const WEAPON_MAP = {
        1: "Broadblade",
        2: "Sword",
        3: "Pistols",
        4: "Gauntlets",
        5: "Rectifier",
    };

    const RC_KEYS = ["rc0", "rc1", "rc2", "rc3", "rc4", "rc5", "rc6"];
    let characters = [];
    let filterElement = 0;
    let filterRank = 0;
    let searchQuery = "";

    let currentPage = 1;
    const itemsPerPage = 20;

    // Elements prefixed with char-
    const tableBody = document.getElementById('char-table-body');
    const emptyMessage = document.getElementById('char-empty-message');
    const searchInput = document.getElementById('char-search-input');
    const elementFiltersContainer = document.getElementById('char-element-filters');
    const rankFiltersContainer = document.getElementById('char-rank-filters');
    const resetBtn = document.getElementById('char-reset-btn');
    const saveServerBtn = document.getElementById('char-save-server-btn');
    const exportBtn = document.getElementById('char-export-btn');
    const statsSummary = document.getElementById('char-stats-summary');
    const footerStats = document.getElementById('char-footer-stats');
    const prevPageBtn = document.getElementById('char-prev-page');
    const nextPageBtn = document.getElementById('char-next-page');
    const pageDisplay = document.getElementById('char-page-display');
    const paginationControls = document.getElementById('char-pagination-controls');

    // Initialize element filters
    function initFilters() {
        if (!elementFiltersContainer || !rankFiltersContainer) return;

        // Clear existing element filters except "All"
        const allBtn = elementFiltersContainer.querySelector('[data-element="0"]');
        elementFiltersContainer.innerHTML = '';
        if (allBtn) elementFiltersContainer.appendChild(allBtn);

        Object.entries(ELEMENT_MAP).forEach(([id, data]) => {
            if (id === "0") return; // Skip multi since it's already there or we don't want duplicate
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.textContent = data.name;
            btn.style.color = data.color;
            btn.dataset.element = id;
            btn.onclick = () => {
                filterElement = parseInt(id);
                currentPage = 1;
                updateFilterButtons('element', btn);
                render();
            };
            elementFiltersContainer.appendChild(btn);
        });

        // Special click for "All" element
        const mainAllBtn = elementFiltersContainer.querySelector('[data-element="0"]');
        if (mainAllBtn) {
            mainAllBtn.onclick = (e) => {
                filterElement = 0;
                currentPage = 1;
                updateFilterButtons('element', e.target);
                render();
            };
        }

        // Rank filters
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
        const container = type === 'element' ? elementFiltersContainer : rankFiltersContainer;
        if (container) {
            container.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            activeBtn.classList.add('active');
        }
    }

    async function initApp() {
        try {
            const res = await fetch('/api/characters');
            const data = await res.json();
            characters = data.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
            initFilters();
            render();
        } catch (e) {
            console.error("Failed to load characters:", e);
            if (statsSummary) statsSummary.textContent = "Error loading data from server.";
        }
    }

    function getFilteredCharacters() {
        return characters.filter(c => {
            const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchElement = filterElement === 0 ||
                c.element === filterElement ||
                (c.element === 0 && [4, 5, 6].includes(filterElement));
            const matchRank = filterRank === 0 || c.rank === filterRank;
            return matchSearch && matchElement && matchRank;
        });
    }

    function render() {
        if (!tableBody) return;
        const filtered = getFilteredCharacters();

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
            paginated.forEach(c => {
                const el = ELEMENT_MAP[c.element];
                const tr = document.createElement('tr');

                let rcCells = '';
                RC_KEYS.forEach(key => {
                    rcCells += `
                        <td class="text-center">
                            <input type="text" 
                                   class="rc-input ${c[key] > 0 ? 'has-value' : ''}" 
                                   value="${c[key]}" 
                                   inputmode="numeric"
                                   onfocus="this.select()"
                                   oninput="updateRC(${c.id}, '${key}', this.value)">
                        </td>
                    `;
                });

                tr.innerHTML = `
                    <td class="text-center" style="color: var(--text-dim)">${c.id}</td>
                    <td style="font-weight: 600">${c.name}</td>
                    <td class="text-center">
                        <span class="rank${c.rank}">${c.rank}★</span>
                    </td>
                    <td>
                        <span class="element-badge" style="background: ${el.bg}; color: ${el.color}; border-color: ${el.color}44">
                            ${el.name}
                        </span>
                    </td>
                    <td style="color: var(--text-dim)">${WEAPON_MAP[c.weapon]}</td>
                    <td class="text-center">
                        <input type="text" 
                               class="rc-input has-value" 
                               style="color: var(--accent); border-color: var(--accent)44; width: 50px;"
                               value="${c.energy}" 
                               inputmode="numeric"
                               onfocus="this.select()"
                               oninput="updateField(${c.id}, 'energy', this.value)">
                    </td>
                    ${rcCells}
                    <td class="text-center">
                        <input type="checkbox" ${c.isActive ? 'checked' : ''} onchange="toggleActive(${c.id})" style="transform: scale(1.2); cursor: pointer; accent-color: var(--accent);">
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        }

        // Update stats
        const total = characters.length;
        const count = filtered.length;
        if (statsSummary) statsSummary.textContent = `${total} characters | Click Active để bật/tắt`;
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
                const container = document.querySelector('#tab-character-editor .table-container');
                if (container) container.scrollTop = 0;
            }
        };
    }

    if (nextPageBtn) {
        nextPageBtn.onclick = () => {
            const filtered = getFilteredCharacters();
            const totalPages = Math.ceil(filtered.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                render();
                const container = document.querySelector('#tab-character-editor .table-container');
                if (container) container.scrollTop = 0;
            }
        };
    }

    // Logic Functions
    window.updateField = (id, key, value) => {
        const stripped = String(value).replace(/[^0-9]/g, "");
        const num = stripped === "" ? 0 : parseInt(stripped, 10);
        const charIndex = characters.findIndex(c => c.id === id);
        if (charIndex !== -1) {
            characters[charIndex][key] = isNaN(num) ? 0 : num;
        }
    };

    window.updateRC = (id, key, value) => {
        const stripped = String(value).replace(/[^0-9]/g, "");
        const num = stripped === "" ? 0 : Math.min(50000, parseInt(stripped, 10));
        const charIndex = characters.findIndex(c => c.id === id);
        if (charIndex !== -1) {
            characters[charIndex][key] = isNaN(num) ? 0 : num;
            // Update specific input style without full re-render for performance
            const input = document.activeElement;
            if (input && input.classList.contains('rc-input') && !input.style.width) {
                if (num > 0) input.classList.add('has-value');
                else input.classList.remove('has-value');
            }
        }
    };

    window.toggleActive = (id) => {
        const charIndex = characters.findIndex(c => c.id === id);
        if (charIndex !== -1) {
            characters[charIndex].isActive = !characters[charIndex].isActive;
            render();
        }
    };

    if (resetBtn) {
        resetBtn.onclick = async () => {
            const confirmed = await showConfirm("Reset RC Values", "Bạn có chắc chắn muốn reset toàn bộ giá trị RC về 0?");
            if (confirmed) {
                characters.forEach(c => {
                    RC_KEYS.forEach(key => c[key] = 0);
                });
                render();
            }
        };
    }

    if (saveServerBtn) {
        saveServerBtn.onclick = async () => {
            try {
                const res = await fetch('/api/characters', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(characters)
                });
                if (res.ok) {
                    showToast("Data Saved to Server!", "success");
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
            const blob = new Blob([JSON.stringify(characters, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "character_updated.json";
            a.click();
            URL.revokeObjectURL(url);
            showToast("JSON Exported Successfully!", "success");
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
    window.refreshCharacterEditor = initApp;
    initApp();
})();
