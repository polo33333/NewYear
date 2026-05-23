const { WebSocketServer } = require('ws');
const url = require('url');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createDefaultState, getRoomId } = require('./state');

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
    const queryRoomId = parsedUrl.query.roomId || '';
    const userId = getUserIdFromToken(token);
    const roomId = getRoomId(userId, token, queryRoomId);
    
    ws.userId = String(userId);
    ws.roomId = String(roomId);
    ws.isControl = parsedUrl.pathname === '/ws/control';
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    const isOverlay = parsedUrl.pathname === '/ws/overlay';
    const isControl = parsedUrl.pathname === '/ws/control';
    console.log(`[WS] Connected: ${isOverlay ? 'OBS Overlay' : 'Control Panel'} | Room ID: ${roomId} (User ID: ${userId})`);

    // Khởi tạo state mặc định cho room nếu chưa có trong RAM
    if (!states[roomId]) {
      states[roomId] = createDefaultState();
    }

    // Gửi full state riêng của room ngay khi connect
    ws.send(JSON.stringify({ type: 'init', roomId: ws.roomId, data: states[roomId] }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        handleMessage(msg, ws.roomId);
      } catch (e) {
        console.error('[WS] Bad message:', e);
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Disconnected | Room ID: ${ws.roomId}`);
    });
  });

  // Gửi ping định kỳ 30 giây một lần để giữ kết nối không bị đóng bởi proxy/host (Heroku, Render, Cloudflare, etc.)
  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) {
        console.log(`[WS] Terminating dead connection for User ID: ${ws.userId}`);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
}

/**
 * Gửi tin nhắn tới tất cả client đang kết nối thuộc về cùng một roomId
 */
function broadcast(msg, roomId) {
  if (!wss) return;
  if (!roomId) roomId = '1';
  const json = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === 1 && client.roomId === String(roomId)) {
      client.send(json);
    }
  });
}

/**
 * Đếm số lượng client đang kết nối hoạt động trong cùng một roomId
 */
function getActiveClientsCount(roomId) {
  if (!wss) return 0;
  if (!roomId) roomId = '1';
  let count = 0;
  wss.clients.forEach(client => {
    if (client.readyState === 1 && client.roomId === String(roomId)) {
      count++;
    }
  });
  return count;
}

/**
 * Đếm số lượng Control Panel đang kết nối hoạt động trong cùng một roomId
 */
function getActiveControlsCount(roomId) {
  if (!wss) return 0;
  if (!roomId) roomId = '1';
  let count = 0;
  wss.clients.forEach(client => {
    if (client.readyState === 1 && client.roomId === String(roomId) && client.isControl === true) {
      count++;
    }
  });
  return count;
}

module.exports = {
  init,
  broadcast,
  getActiveClientsCount,
  getActiveControlsCount,
  getWss: () => wss
};
