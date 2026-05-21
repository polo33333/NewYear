const token = localStorage.getItem('nexus_auth_token');
if (!token && !window.location.pathname.includes('/login')) {
  window.location.href = '/login';
}

window.logout = function() {
  fetch('/api/reset-state', { method: 'POST' })
    .catch(err => console.error('Error resetting state on logout:', err))
    .finally(() => {
      localStorage.removeItem('nexus_auth_token');
      window.location.href = '/login';
    });
};
