/**
 * toast.js - Custom global toast & confirmation system for MATRIX HUB
 * Dynamically mounts styled elements and handles high-end eSports glassmorphism animations.
 */

window.showToast = function(message, type = 'success') {
    // 1. Check if toast container exists, if not, create it
    let container = document.getElementById('nexus-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'nexus-toast-container';
        container.style.cssText = `
            position: fixed;
            top: 24px;
            right: 24px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    // 2. Create the toast element
    const toast = document.createElement('div');
    toast.className = `nexus-toast ${type}`;
    
    // Choose icon and styles based on type
    let icon = 'fa-check-circle';
    let bg = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    let border = 'rgba(16, 185, 129, 0.2)';
    
    if (type === 'error' || type === 'danger' || type === false) {
        icon = 'fa-exclamation-triangle';
        bg = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        border = 'rgba(239, 68, 68, 0.2)';
    } else if (type === 'warning') {
        icon = 'fa-exclamation-circle';
        bg = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        border = 'rgba(245, 158, 11, 0.2)';
    } else if (type === 'info') {
        icon = 'fa-info-circle';
        bg = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
        border = 'rgba(59, 130, 246, 0.2)';
    }

    toast.style.cssText = `
        background: ${bg};
        border: 1px solid ${border};
        color: #fff;
        padding: 14px 20px;
        border-radius: 8px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4), 0 0 15px rgba(0, 0, 0, 0.2);
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 300px;
        max-width: 450px;
        pointer-events: auto;
        transform: translateX(120%);
        transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
        opacity: 0;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
    `;

    toast.innerHTML = `
        <i class="fas ${icon}" style="font-size: 16px;"></i>
        <span style="flex: 1; line-height: 1.4;">${message}</span>
        <button style="background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; font-size: 14px; padding: 2px; transition: 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,0.7)'" onclick="this.parentElement.style.transform='translateX(120%)'; this.parentElement.style.opacity='0'; setTimeout(() => this.parentElement.remove(), 400)">
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
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(4, 6, 12, 0.85);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 999999;
            opacity: 0;
            transition: opacity 0.2s ease;
        `;

        // 2. Create confirm card
        const card = document.createElement('div');
        card.style.cssText = `
            background: rgba(10, 15, 30, 0.95);
            border: 1px solid rgba(0, 245, 255, 0.25);
            border-radius: 12px;
            width: 420px;
            max-width: 90vw;
            padding: 28px 24px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 245, 255, 0.05);
            text-align: center;
            transform: scale(0.9);
            transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            font-family: 'Inter', sans-serif;
            color: #fff;
        `;

        card.innerHTML = `
            <div style="font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 800; letter-spacing: 1px; color: #00f5ff; margin-bottom: 12px; text-transform: uppercase;">
                <i class="fas fa-circle-question" style="margin-right: 8px;"></i>${title}
            </div>
            <div style="font-size: 14px; color: rgba(255,255,255,0.7); line-height: 1.5; margin-bottom: 24px; white-space: pre-line;">
                ${message}
            </div>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="nexus-confirm-cancel" style="flex: 1; height: 38px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-weight: 600; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">HUỶ</button>
                <button id="nexus-confirm-ok" style="flex: 1; height: 38px; background: linear-gradient(135deg, #00f5ff 0%, #00b8d4 100%); border: none; border-radius: 6px; color: #050811; font-weight: 800; cursor: pointer; transition: 0.2s;" onmouseover="this.style.filter='brightness(1.15)'" onmouseout="this.style.filter='none'">XÁC NHẬN</button>
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
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(4, 6, 12, 0.85);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 999999;
            opacity: 0;
            transition: opacity 0.2s ease;
        `;

        // 2. Create prompt card
        const card = document.createElement('div');
        card.style.cssText = `
            background: rgba(10, 15, 30, 0.95);
            border: 1px solid rgba(0, 245, 255, 0.25);
            border-radius: 12px;
            width: 420px;
            max-width: 90vw;
            padding: 28px 24px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 245, 255, 0.05);
            text-align: left;
            transform: scale(0.9);
            transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            font-family: 'Inter', sans-serif;
            color: #fff;
        `;

        card.innerHTML = `
            <div style="font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 800; letter-spacing: 1px; color: #00f5ff; margin-bottom: 12px; text-transform: uppercase; text-align: center;">
                <i class="fab fa-google-drive" style="margin-right: 8px;"></i>${title}
            </div>
            <div style="font-size: 14px; color: rgba(255,255,255,0.7); line-height: 1.5; margin-bottom: 16px;">
                ${message}
            </div>
            <input type="text" id="nexus-prompt-input" value="${defaultValue}" style="width: 100%; height: 38px; background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(0, 245, 255, 0.2); border-radius: 6px; padding: 0 12px; color: #fff; font-family: 'Inter', sans-serif; font-size: 14px; margin-bottom: 24px; outline: none; transition: 0.2s; box-sizing: border-box;" onfocus="this.style.borderColor='#00f5ff'; this.style.boxShadow='0 0 10px rgba(0, 245, 255, 0.15)'" onblur="this.style.borderColor='rgba(0, 245, 255, 0.2)'; this.style.boxShadow='none'" />
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="nexus-prompt-cancel" style="flex: 1; height: 38px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-weight: 600; cursor: pointer; transition: 0.2s; text-align: center;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">HUỶ</button>
                <button id="nexus-prompt-ok" style="flex: 1; height: 38px; background: linear-gradient(135deg, #00f5ff 0%, #00b8d4 100%); border: none; border-radius: 6px; color: #050811; font-weight: 800; cursor: pointer; transition: 0.2s; text-align: center;" onmouseover="this.style.filter='brightness(1.15)'" onmouseout="this.style.filter='none'">ĐỒNG BỘ</button>
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
