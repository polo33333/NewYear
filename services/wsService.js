const { WebSocketServer } = require('ws');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { createDefaultState } = require('./state');

const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');
let wss = null;

/**
 * Trích xuất User ID từ token (kiểm tra token Control Panel và settings.json của OBS Overlay)
 */
function getUserIdFromToken(token) {
  if (!token) return '1';

  // 1. Token Control Panel: kdone-token-{userId}-{timestamp}
  const parts = token.split('-');
  if (parts.length >= 3 && parts[0] === 'kdone' && parts[1] === 'token') {
    return String(parts[2]);
  }

  // 2. Token OBS Overlay: Kiểm tra settings.json
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf8');
      if (content.trim()) {
        const allSettings = JSON.parse(content);
        
        // Cấu trúc cũ legacy
        if (allSettings && !allSettings['1'] && (allSettings.obsToken || allSettings.googleAppsScriptUrl)) {
          if (allSettings.obsToken === token) {
            return '1';
          }
        } else {
          // Duyệt tìm user có obsToken trùng khớp
          for (const uId in allSettings) {
            if (allSettings[uId] && allSettings[uId].obsToken === token) {
              return String(uId);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('[WS] Error parsing settings for token:', e.message);
  }

  // Token mặc định
  if (token === 'kdstream2026') return '1';

  return '1';
}

/**
 * Khởi động WebSocket Server kết nối tới HTTP Server
 */
function init(server, states, handleMessage) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const parsedUrl = url.parse(req.url, true);
    const token = parsedUrl.query.token || '';
    const userId = getUserIdFromToken(token);
    
    ws.userId = String(userId);

    const isOverlay = parsedUrl.pathname === '/ws/overlay';
    const isControl = parsedUrl.pathname === '/ws/control';
    console.log(`[WS] Connected: ${isOverlay ? 'OBS Overlay' : 'Control Panel'} | User ID: ${userId}`);

    // Khởi tạo state mặc định cho user nếu chưa có trong RAM
    if (!states[userId]) {
      states[userId] = createDefaultState();
    }

    // Gửi full state riêng của user ngay khi connect
    ws.send(JSON.stringify({ type: 'init', data: states[userId] }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        handleMessage(msg, ws.userId);
      } catch (e) {
        console.error('[WS] Bad message:', e);
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Disconnected | User ID: ${ws.userId}`);
    });
  });

  return wss;
}

/**
 * Gửi tin nhắn tới tất cả client đang kết nối thuộc về cùng một userId
 */
function broadcast(msg, userId) {
  if (!wss) return;
  if (!userId) userId = '1';
  const json = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === 1 && client.userId === String(userId)) {
      client.send(json);
    }
  });
}

module.exports = {
  init,
  broadcast,
  getWss: () => wss
};
