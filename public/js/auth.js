const token = localStorage.getItem('nexus_auth_token');
if (!token && !window.location.pathname.includes('/login')) {
  window.location.href = '/login';
}

window.logout = function() {
  localStorage.removeItem('nexus_auth_token');
  window.location.href = '/login';
};
