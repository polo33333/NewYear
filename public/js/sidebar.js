document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('app-sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');

    if (sidebar && toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('mini');
        });
    }

    // Global helper to update mini player visibility based on tab and play state
    window.currentTab = 'control';
    window.updateMiniPlayerVisibility = function() {
        const miniPlayer = document.getElementById('mini-music-player');
        if (!miniPlayer) return;
        
        const isPlaying = miniPlayer.classList.contains('playing');
        const isControlTab = window.currentTab === 'control';
        
        if (isControlTab) {
            miniPlayer.style.display = 'none';
        } else {
            miniPlayer.style.display = isPlaying ? 'flex' : 'none';
        }
    };

    // SPA Tab Switcher
    window.switchTab = function(tabName) {
        window.currentTab = tabName;

        let targetTab = document.getElementById('tab-' + tabName);
        
        // 1. If tab container doesn't exist, create it dynamically
        if (!targetTab) {
            targetTab = document.createElement('div');
            targetTab.id = 'tab-' + tabName;
            targetTab.className = 'main-content-tab custom-scroll';
            targetTab.style.display = 'none';
            targetTab.style.overflowY = 'auto'; // FIX: Enable scrolling for dynamic tabs like Settings
            targetTab.style.paddingBottom = '32px';
            // Append it to the main-content wrapper
            document.querySelector('.main-content').appendChild(targetTab);
        }

        // 2. Hide all tabs, show target tab
        const allTabs = document.querySelectorAll('.main-content-tab');
        allTabs.forEach(tab => {
            if (tab.id === 'tab-' + tabName) {
                tab.style.display = 'flex'; // Use flex so inner contents expand properly
                tab.classList.add('active-tab');
            } else {
                tab.style.display = 'none';
                tab.classList.remove('active-tab');
            }
        });

        // 3. Check if we need to load this tab dynamically
        if (targetTab) {
            
            // Check if we need to load this tab dynamically
            if (tabName !== 'control' && targetTab.innerHTML.trim() === '') {
                // Show loading spinner
                targetTab.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; gap: 15px; color: var(--accent);">
                        <i class="fas fa-circle-notch fa-spin" style="font-size: 32px; filter: drop-shadow(0 0 8px var(--accent));"></i>
                        <span style="font-family: 'Outfit', sans-serif; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.8;">Loading page...</span>
                    </div>
                `;
                
                // Fetch the static HTML page directly (with cache buster)
                fetch('/templates/' + tabName + '?t=' + new Date().getTime())
                    .then(response => {
                        if (!response.ok) throw new Error('Failed to fetch page');
                        return response.text();
                    })
                    .then(htmlText => {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(htmlText, 'text/html');
                        const mainContent = doc.querySelector('.main-content');
                        
                        let scriptSrc = '/js/' + tabName + '.js';
                        if (mainContent) {
                            // Find original script source to preserve cache busting (e.g. ?v=2)
                            const origScript = mainContent.querySelector(`script[src*="${tabName}.js"]`);
                            if (origScript && origScript.getAttribute('src')) {
                                scriptSrc = origScript.getAttribute('src');
                                if (!scriptSrc.startsWith('/')) {
                                    scriptSrc = '/' + scriptSrc;
                                }
                            }
                            
                            // Strip any inner scripts from being executed immediately in HTML
                            mainContent.querySelectorAll('script').forEach(s => s.remove());
                            targetTab.innerHTML = mainContent.innerHTML;
                            
                            // After injecting HTML:
                            // 1. Update Welcome text across all headers
                            if (typeof window.updateUserWelcome === 'function') {
                                window.updateUserWelcome();
                            }
                            
                            // 2. Sync connection status from control tab
                            const controlDot = document.querySelector('#tab-control .conn-dot');
                            const isOnline = controlDot && controlDot.classList.contains('online');
                            targetTab.querySelectorAll('.conn-dot').forEach(el => el.className = 'conn-dot status-dot ' + (isOnline ? 'online' : ''));
                            targetTab.querySelectorAll('.conn-text').forEach(el => el.textContent = isOnline ? 'CONNECTED' : 'OFFLINE');
                        } else {
                            targetTab.innerHTML = htmlText;
                        }

                        // Render user welcome message for the new page template
                        if (typeof window.updateUserWelcome === 'function') {
                            window.updateUserWelcome();
                        }
                        
                        // Dynamically append the scoped module script
                        const scriptId = 'script-' + tabName;
                        if (!document.getElementById(scriptId)) {
                            const script = document.createElement('script');
                            script.id = scriptId;
                            script.src = scriptSrc;
                            document.body.appendChild(script);
                        }
                    })
                    .catch(err => {
                        console.error('Error loading SPA tab:', err);
                        targetTab.innerHTML = `
                            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; gap: 15px; color: var(--danger);">
                                <i class="fas fa-exclamation-triangle" style="font-size: 32px;"></i>
                                <span style="font-family: 'Outfit', sans-serif; font-size: 14px;">Failed to load tab. Please refresh.</span>
                            </div>
                        `;
                    });
            }
            
            // Re-trigger layout adjustments for specific tab contents if necessary
            if (tabName === 'control' && typeof window.resizePreview === 'function') {
                window.resizePreview();
            }

            // Trigger refresh function for the tab if it has one and is already loaded
            const refreshFnName = 'refresh' + tabName.charAt(0).toUpperCase() + tabName.slice(1).replace(/-([a-z])/g, g => g[1].toUpperCase());
            if (typeof window[refreshFnName] === 'function') {
                window[refreshFnName]();
            }
        }

        // 3. Mark sidebar link as active
        const links = document.querySelectorAll('.nav-link');
        links.forEach(link => {
            const isTarget = link.dataset.tab === tabName;
            link.classList.toggle('active', isTarget);
        });

        // 4. Update address bar without page reload
        const newPath = tabName === 'control' ? '/' : '/' + tabName;
        if (window.location.pathname !== newPath) {
            history.pushState({ tab: tabName }, '', newPath);
        }

        // 5. Toggle Mini Player visibility
        if (typeof window.updateMiniPlayerVisibility === 'function') {
            window.updateMiniPlayerVisibility();
        }
    };

    // Intercept nav links click
    const links = document.querySelectorAll('.nav-link');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            const tabName = link.dataset.tab;
            if (tabName) {
                e.preventDefault();
                window.switchTab(tabName);
            }
        });
    });

    // Handle browser Back/Forward navigation
    window.addEventListener('popstate', (e) => {
        const path = window.location.pathname;
        let tabName = 'control';
        if (path === '/character-editor') tabName = 'character-editor';
        else if (path === '/weapon-editor') tabName = 'weapon-editor';
        else if (path === '/history') tabName = 'history';
        else if (path === '/settings') tabName = 'settings';
        else if (path === '/bracket') tabName = 'bracket';
        
        window.switchTab(tabName);
    });

    // Initial mount based on actual URL pathname
    const initPath = window.location.pathname;
    let initialTab = 'control';
    if (initPath === '/character-editor') initialTab = 'character-editor';
    else if (initPath === '/weapon-editor') initialTab = 'weapon-editor';
    else if (initPath === '/history') initialTab = 'history';
    else if (initPath === '/settings') initialTab = 'settings';
    else if (initPath === '/bracket') initialTab = 'bracket';

    // Apply saved accent color globally
    const savedAccent = localStorage.getItem('uiAccentColor');
    if (savedAccent) {
        document.documentElement.style.setProperty('--accent', savedAccent);
    }

    // Activate the initial tab
    window.switchTab(initialTab);
});
