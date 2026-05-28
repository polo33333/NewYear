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
  const username = localStorage.getItem('kdone_username') || 'User';
  const headerRights = document.querySelectorAll('.header-right');
  headerRights.forEach(headerRight => {
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

      const statusGroup = headerRight.querySelector('.header-status-group');
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
