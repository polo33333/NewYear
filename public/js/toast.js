/**
 * toast.js - Custom global toast & confirmation system for MATRIX HUB
 * Dynamically mounts styled elements and handles high-end eSports glassmorphism animations.
 */

/**
 * escapeHtml — ngăn XSS khi chèn text vào innerHTML
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.showToast = function(message, type = 'success') {
    // 1. Check if toast container exists, if not, create it
    let container = document.getElementById('nexus-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'nexus-toast-container';
        document.body.appendChild(container);
    }

    // 2. Create the toast element
    const toast = document.createElement('div');
    toast.className = `nexus-toast ${type}`;
    
    // Choose icon based on type
    let icon = 'fa-check-circle';
    if (type === 'error' || type === 'danger' || type === false) {
        icon = 'fa-exclamation-triangle';
    } else if (type === 'warning') {
        icon = 'fa-exclamation-circle';
    } else if (type === 'info') {
        icon = 'fa-info-circle';
    }

    toast.innerHTML = `
        <i class="fas ${icon}" style="font-size: 16px;"></i>
        <span style="flex: 1; line-height: 1.4;">${escapeHtml(message)}</span>
        <button class="nexus-toast-close" onclick="this.parentElement.style.transform='translateX(120%)'; this.parentElement.style.opacity='0'; setTimeout(() => this.parentElement.remove(), 400)">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    // Trigger slide-in animation
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    });

    // Auto-remove animation sequence
    setTimeout(() => {
        if (toast && toast.parentElement) {
            toast.style.transform = 'translateX(120%)';
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast && toast.parentElement) toast.remove();
            }, 400);
        }
    }, 4000);
};

/**
 * showConfirm - Custom Promise-based modal confirmation system in matrix theme.
 * Usage: const confirmed = await showConfirm("Xác nhận", "Bạn có chắc chắn muốn làm việc này?");
 */
window.showConfirm = function(title, message) {
    return new Promise((resolve) => {
        // 1. Create confirm overlay
        const overlay = document.createElement('div');
        overlay.id = 'nexus-confirm-overlay';
        overlay.className = 'nexus-modal-overlay';

        // 2. Create confirm card
        const card = document.createElement('div');
        card.className = 'nexus-modal-card';

        card.innerHTML = `
            <div class="nexus-modal-title">
                <i class="fas fa-circle-question" style="margin-right: 8px;"></i>${escapeHtml(title)}
            </div>
            <div class="nexus-modal-message">
                ${escapeHtml(message)}
            </div>
            <div class="nexus-modal-actions">
                <button id="nexus-confirm-cancel" class="nexus-modal-btn-cancel">HUỶ</button>
                <button id="nexus-confirm-ok" class="nexus-modal-btn-ok">XÁC NHẬN</button>
            </div>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // Trigger animations
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            card.style.transform = 'scale(1)';
        });

        // Cleanup function
        const cleanup = (result) => {
            overlay.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 200);
        };

        // Click handlers
        overlay.querySelector('#nexus-confirm-cancel').onclick = () => cleanup(false);
        overlay.querySelector('#nexus-confirm-ok').onclick = () => cleanup(true);
    });
};

/**
 * showPrompt - Custom Promise-based modal prompt system in matrix theme.
 * Usage: const inputVal = await showPrompt("Cấu hình", "Nhập tên tab Google Sheet:", "Match History");
 */
window.showPrompt = function(title, message, defaultValue = '') {
    return new Promise((resolve) => {
        // 1. Create prompt overlay
        const overlay = document.createElement('div');
        overlay.id = 'nexus-prompt-overlay';
        overlay.className = 'nexus-modal-overlay';

        // 2. Create prompt card
        const card = document.createElement('div');
        card.className = 'nexus-modal-card left-align';

        card.innerHTML = `
            <div class="nexus-modal-title center">
                <i class="fab fa-google-drive" style="margin-right: 8px;"></i>${escapeHtml(title)}
            </div>
            <div class="nexus-modal-message">
                ${escapeHtml(message)}
            </div>
            <input type="text" id="nexus-prompt-input" class="nexus-modal-prompt-input" value="${escapeHtml(defaultValue)}" />
            <div class="nexus-modal-actions">
                <button id="nexus-prompt-cancel" class="nexus-modal-btn-cancel">HUỶ</button>
                <button id="nexus-prompt-ok" class="nexus-modal-btn-ok">ĐỒNG BỘ</button>
            </div>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        const inputField = card.querySelector('#nexus-prompt-input');
        
        // Auto focus and select input text
        setTimeout(() => {
            inputField.focus();
            inputField.select();
        }, 50);

        // Trigger animations
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            card.style.transform = 'scale(1)';
        });

        // Cleanup function
        const cleanup = (val) => {
            overlay.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
            setTimeout(() => {
                overlay.remove();
                resolve(val);
            }, 200);
        };

        // Click handlers
        overlay.querySelector('#nexus-prompt-cancel').onclick = () => cleanup(null);
        overlay.querySelector('#nexus-prompt-ok').onclick = () => cleanup(inputField.value);

        // Enter key handler
        inputField.onkeydown = (e) => {
            if (e.key === 'Enter') {
                cleanup(inputField.value);
            } else if (e.key === 'Escape') {
                cleanup(null);
            }
        };
    });
};
