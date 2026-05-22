const WS_URL = `ws://${location.host}/ws/overlay${location.search}`;
let ws;

function connect() {
  ws = new WebSocket(WS_URL);
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'init') {
      updateTicker(msg.data.ticker);
      toggle(msg.data.overlays.ticker);
    } else if (msg.type === 'ticker') {
      updateTicker(msg.data);
    } else if (msg.type === 'overlays') {
      toggle(msg.data.ticker);
    }
  };
  ws.onclose = () => setTimeout(connect, 2000);
}

function updateTicker(ticker) {
  const items = ticker.items;
  const doubled = [...items, ...items];
  const html = doubled.map(item =>
    `<span style="margin-right:60px">${item}</span><span class="ticker-sep">◆</span>`
  ).join('');
  document.getElementById('tickerInner').innerHTML = html;
}

function toggle(visible) {
  document.getElementById('ticker').classList.toggle('hidden', !visible);
}

connect();
