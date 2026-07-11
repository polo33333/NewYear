// Apply UI Mode immediately to avoid flickering
const savedUIMode = localStorage.getItem('uiMode') || 'dark';
document.documentElement.setAttribute('data-ui-mode', savedUIMode);
document.documentElement.style.backgroundColor = savedUIMode === 'light' ? '#f0f2f7' : '#060a16';

// Inject loading overlay stylesheet dynamically
const overlayStyle = document.createElement('style');
overlayStyle.innerHTML = `
#theme-loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 100000;
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 1;
    transition: opacity 0.3s ease, visibility 0.3s;
    visibility: visible;
}
#theme-loading-overlay.theme-dark {
    background: #060a16;
}
#theme-loading-overlay.theme-light {
    background: #f0f2f7;
}
#theme-loading-overlay.fade-out {
    opacity: 0;
    visibility: hidden;
}
.nexus-loader {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: inline-block;
    position: relative;
    box-sizing: border-box;
    animation: rotation 1s linear infinite;
}
#theme-loading-overlay.theme-dark .nexus-loader {
    border: 3px solid rgba(0, 245, 255, 0.1);
}
#theme-loading-overlay.theme-light .nexus-loader {
    border: 3px solid #e2e6ef;
}
.nexus-loader::after {
    content: '';  
    box-sizing: border-box;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid transparent;
}
#theme-loading-overlay.theme-dark .nexus-loader::after {
    border-bottom-color: #00f5ff;
}
#theme-loading-overlay.theme-light .nexus-loader::after {
    border-bottom-color: #5b6af0;
}
@keyframes rotation {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
`;
document.head.appendChild(overlayStyle);

document.addEventListener('DOMContentLoaded', () => {
    document.body.setAttribute('data-ui-mode', savedUIMode);
    document.documentElement.style.backgroundColor = '';

    // Create overlay element
    const overlay = document.createElement('div');
    overlay.id = 'theme-loading-overlay';
    overlay.classList.add(savedUIMode === 'light' ? 'theme-light' : 'theme-dark');
    overlay.innerHTML = '<span class="nexus-loader"></span>';
    document.body.appendChild(overlay);

    // Hide overlay when page is fully loaded
    const hideOverlay = () => {
        setTimeout(() => {
            overlay.classList.add('fade-out');
            setTimeout(() => overlay.remove(), 300);
        }, 150);
    };

    if (document.readyState === 'complete') {
        hideOverlay();
    } else {
        window.addEventListener('load', hideOverlay);
    }
});

const token = localStorage.getItem('kdone_auth_token');
const userId = localStorage.getItem('kdone_user_id');

if (!token && !window.location.pathname.includes('/login')) {
  window.location.href = '/login';
}

// Override global fetch to automatically add X-User-Id, Authorization, and X-Room-Id headers
const originalFetch = window.fetch;
window.fetch = function (url, options = {}) {
  const currentToken = localStorage.getItem('kdone_auth_token');
  const currentUserId = localStorage.getItem('kdone_user_id');
  const currentRoomId = sessionStorage.getItem('kdone_current_room_id');
  if (currentToken) {
    options.headers = options.headers || {};
    if (!(options.headers instanceof Headers)) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${currentToken}`,
        'X-User-Id': currentUserId
      };
      if (currentRoomId) {
        options.headers['X-Room-Id'] = currentRoomId;
      }
    } else {
      options.headers.set('Authorization', `Bearer ${currentToken}`);
      options.headers.set('X-User-Id', currentUserId);
      if (currentRoomId) {
        options.headers.set('X-Room-Id', currentRoomId);
      }
    }
  }
  return originalFetch(url, options).then(response => {
    const headerRoomId = response.headers.get('X-Room-Id');
    if (headerRoomId) {
      sessionStorage.setItem('kdone_current_room_id', headerRoomId);
    }
    return response;
  });
};

window.logout = async function () {
  // Hỏi xác nhận trước khi đăng xuất
  const confirmed = typeof window.showConfirm === 'function'
    ? await window.showConfirm('Đăng Xuất', 'Bạn có chắc chắn muốn đăng xuất không?')
    : window.confirm('Bạn có chắc chắn muốn đăng xuất không?');

  if (!confirmed) return;

  fetch('/api/reset-state', { method: 'POST' })
    .catch(err => console.error('Error resetting state on logout:', err))
    .finally(() => {
      localStorage.removeItem('kdone_auth_token');
      localStorage.removeItem('kdone_user_id');
      localStorage.removeItem('kdone_username');
      localStorage.removeItem('kdone_is_admin');
      sessionStorage.removeItem('kdone_current_room_id');
      window.location.href = '/login';
    });
};

window.updateUserWelcome = function () {
  const username = localStorage.getItem('kdone_username') || 'ADMIN';
  const headerRights = document.querySelectorAll('.header-right');

  headerRights.forEach(headerRight => {
    const statusGroup = headerRight.querySelector('.header-status-group');

    if (!headerRight.querySelector('.user-welcome-text')) {
      const welcomeSpan = document.createElement('span');
      welcomeSpan.className = 'user-welcome-text';
      welcomeSpan.style.fontFamily = "'Outfit', sans-serif";
      welcomeSpan.style.fontSize = '11px';
      welcomeSpan.style.fontWeight = '700';
      welcomeSpan.style.letterSpacing = '1px';
      welcomeSpan.style.textTransform = 'uppercase';
      welcomeSpan.style.color = '#8e9aa8';
      welcomeSpan.style.display = 'inline-flex';
      welcomeSpan.style.alignItems = 'center';
      welcomeSpan.innerHTML = `WELCOME, <span style="font-weight: 900; color: var(--accent); margin-left: 4px;">${username.toUpperCase()}</span>`;
      
      // Try to insert before status dot, or if no status dot, at the beginning of header-right
      if (statusGroup) {
        welcomeSpan.style.marginRight = '0';
        statusGroup.insertBefore(welcomeSpan, statusGroup.firstChild);
      } else {
        welcomeSpan.style.marginRight = '0';
        headerRight.insertBefore(welcomeSpan, headerRight.firstChild);
      }
    }
  });
};

document.addEventListener('DOMContentLoaded', () => {
  // Render user welcome message
  window.updateUserWelcome();

  const isAdmin = localStorage.getItem('kdone_is_admin') === 'true';
  if (!isAdmin) {
    // Fade and disable Reset and Save buttons in Character Editor
    const charResetBtn = document.getElementById('char-reset-btn');
    const charSaveBtn = document.getElementById('char-save-server-btn');
    if (charResetBtn) {
      charResetBtn.style.opacity = '0.35';
      charResetBtn.style.pointerEvents = 'none';
      charResetBtn.disabled = true;
    }
    if (charSaveBtn) {
      charSaveBtn.style.opacity = '0.35';
      charSaveBtn.style.pointerEvents = 'none';
      charSaveBtn.disabled = true;
    }

    // Fade and disable Reset and Save buttons in Weapon Editor
    const wpResetBtn = document.getElementById('wp-reset-btn');
    const wpSaveBtn = document.getElementById('wp-save-server-btn');
    if (wpResetBtn) {
      wpResetBtn.style.opacity = '0.35';
      wpResetBtn.style.pointerEvents = 'none';
      wpResetBtn.disabled = true;
    }
    if (wpSaveBtn) {
      wpSaveBtn.style.opacity = '0.35';
      wpSaveBtn.style.pointerEvents = 'none';
      wpSaveBtn.disabled = true;
    }
  }
});
