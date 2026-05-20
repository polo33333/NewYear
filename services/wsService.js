const { WebSocketServer } = require('ws');

let wss = null;

/**
 * Khởi tạo WebSocket Server kết nối tới HTTP Server
 */
function init(server, state, handleMessage) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const isOverlay = req.url === '/ws/overlay';
    const isControl = req.url === '/ws/control';
    console.log(`[WS] Connected: ${isOverlay ? 'OBS Overlay' : 'Control Panel'}`);

    // Gửi full state ngay khi connect
    ws.send(JSON.stringify({ type: 'init', data: state }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        handleMessage(msg);
      } catch (e) {
        console.error('[WS] Bad message:', e);
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Disconnected`);
    });
  });

  return wss;
}

/**
 * Gửi tin nhắn tới tất cả client đang kết nối
 */
function broadcast(msg) {
  if (!wss) return;
  const json = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(json);
    }
  });
}

module.exports = {
  init,
  broadcast,
  getWss: () => wss
};
