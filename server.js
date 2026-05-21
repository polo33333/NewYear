/**
 * MATRIX HUD — Server
 * Chạy: node server.js
 * OBS trỏ vào: http://localhost:3000/live?token=kdstream2026
 * Control panel: http://localhost:3000
 */

const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

app.use(express.json());

// Clean URLs Middleware: Redirect any request ending in .html to clean version
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    let cleanPath = req.path.slice(0, -5);
    if (cleanPath === '/control') cleanPath = '/';
    else if (cleanPath === '/overlay') cleanPath = '/live';
    const query = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : '';
    return res.redirect(301, cleanPath + query);
  }
  next();
});

// Serve Service Worker with root scope permissions even though it's inside public/js/
app.get('/js/sw.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'public/js/sw.js'));
});

// Serve manifest.json directly from the project root folder
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'manifest.json'));
});

// Serve raw templates for dynamic SPA loading, bypassing the Clean URLs redirects
app.get('/templates/:page', (req, res) => {
  const page = req.params.page;
  const fs = require('fs');
  const filePath = path.join(__dirname, 'public', `${page}.html`);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Template Not Found');
  }
});

// Alias /images/weapons to public/images/weapon (plural vs singular difference in database JSON vs asset directories)
app.use('/images/weapons', express.static(path.join(__dirname, 'public/images/weapon')));

app.use(express.static(path.join(__dirname, 'public')));

// ── State, Websocket, & Background Services ──
const state = require('./services/state');
const wsService = require('./services/wsService');
const stateService = require('./services/stateService');

// Initialize services
wsService.init(server, state, stateService.handleWSMessage);
stateService.init();

// ── Router Modules ──
const apiRouter = require('./routes/api');
const { router: viewsRouter, getObsToken } = require('./routes/views');

app.use('/api', apiRouter);
app.use('/', viewsRouter);

const PORT = process.env.PORT || 4100;
server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║        NEXUS STREAM SERVER RUNNING        ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Control Panel → http://localhost:${PORT}     ║`);
  console.log(`║  OBS URL       → http://localhost:${PORT}/live?token=${getObsToken()} ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});