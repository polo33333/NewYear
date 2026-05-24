const OBSMonitor = require('../src/obs/obsMonitor');
const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');
const monitors = {}; // userId -> OBSMonitor

function getSettingsForUser(userId) {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
      if (content.trim()) {
        const allSettings = JSON.parse(content);
        return allSettings[userId] || {};
      }
    }
  } catch (e) {
    console.error(`Error reading settings for user ${userId}:`, e.message);
  }
  return {};
}

function getOrCreateMonitor(userId) {
  const uId = String(userId);
  if (!monitors[uId]) {
    const monitor = new OBSMonitor();
    monitors[uId] = monitor;
    
    // Bind event listeners for this monitor
    monitor.on('status', (data) => {
      // Broadcast to clients belonging to this userId
      const wsService = require('./wsService');
      const wss = wsService.getWss();
      if (wss) {
        wss.clients.forEach(client => {
          if (client.userId === uId && client.readyState === 1) {
            client.send(JSON.stringify({ type: 'obs:status', data }));
          }
        });
      }
    });

    monitor.on('stats', (stats) => {
      const wsService = require('./wsService');
      const wss = wsService.getWss();
      if (wss) {
        // Collect rooms of active clients for this userId
        const rooms = new Set();
        wss.clients.forEach(client => {
          if (client.userId === uId && client.roomId) {
            rooms.add(client.roomId);
          }
        });
        rooms.forEach(roomId => {
          const roomStats = { ...stats };
          roomStats.connectedOverlays = wsService.getActiveOverlaysCount(roomId);
          wsService.broadcast({ type: 'obs:stats', data: roomStats }, roomId);
        });
      }
    });
    
    // Connect monitor using settings from settings.json
    const userSettings = getSettingsForUser(uId);
    const host = userSettings.obsHost || 'localhost';
    const port = userSettings.obsPort || '4455';
    const password = userSettings.obsPassword || '';
    monitor.connect(host, port, password);
  }
  return monitors[uId];
}

function updateMonitorConnection(userId) {
  const uId = String(userId);
  const monitor = monitors[uId];
  if (monitor) {
    monitor.onDisconnect(); // this cleans up timers and stops polling
  }
  
  // Re-create or re-connect
  delete monitors[uId];
  getOrCreateMonitor(uId);
}

module.exports = {
  getMonitor: (userId) => getOrCreateMonitor(userId),
  updateMonitorConnection,
  initAll: () => {
    // Lazily initialize connection monitors on socket client connection to prevent auth loops for inactive users
  }
};
