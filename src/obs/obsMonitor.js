const OBSWebSocket = require('obs-websocket-js').default || require('obs-websocket-js');
const EventEmitter = require('events');

class OBSMonitor extends EventEmitter {
  constructor() {
    super();
    this.obs = new OBSWebSocket();
    this.connected = false;
    this.streaming = false;
    this.recording = false;
    this.uptime = '00:00:00';
    this.bitrate = 0;
    this.droppedFrames = 0;
    this.droppedFramesPct = '0.0';
    this.totalFrames = 0;
    this.resolution = '1920x1080';
    this.fps = 0;
    this.connectedOverlays = 0;

    // Byte tracking for bitrate calculations
    this.lastBytes = undefined;
    this.lastBytesTime = undefined;

    this.reconnectTimer = null;
    this.pollingTimer = null;

    this.host = 'localhost';
    this.port = '4455';
    this.password = '';

    // Bind event handlers
    this.obs.on('Identified', () => this.onConnect());
    this.obs.on('ConnectionClosed', () => this.onDisconnect());
    this.obs.on('ConnectionError', (err) => this.onError(err));
    this.obs.on('StreamStateChanged', (data) => this.onStreamStateChanged(data));
    this.obs.on('RecordStateChanged', (data) => this.onRecordStateChanged(data));
  }

  async connect(host = 'localhost', port = '4455', password = '') {
    this.host = host;
    this.port = port;
    this.password = password;

    const url = `ws://${host}:${port}`;
    console.log(`[OBS] [${new Date().toLocaleString()}] Connecting to OBS WebSocket at ${url}...`);

    try {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      await this.obs.connect(url, password);
    } catch (err) {
      console.error(`[OBS] [${new Date().toLocaleString()}] Connection failed: ${err.message}`);
      this.triggerReconnect();
    }
  }

  triggerReconnect() {
    if (this.reconnectTimer) return;
    this.connected = false;
    this.emit('status', { connected: false });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(this.host, this.port, this.password);
    }, 3000);
  }

  async onConnect() {
    console.log(`[OBS] [${new Date().toLocaleString()}] Connected to OBS successfully.`);
    this.connected = true;
    this.emit('status', { connected: true });

    try {
      // Get output video settings once on connect
      const videoSettings = await this.obs.call('GetVideoSettings');
      this.resolution = `${videoSettings.outputWidth}x${videoSettings.outputHeight}`;
      this.fps = Math.round(videoSettings.fpsNumerator / videoSettings.fpsDenominator);
      console.log(`[OBS] Output video settings: ${this.resolution} @ ${this.fps} FPS`);

      // Get initial stream and record states
      const streamStatus = await this.obs.call('GetStreamStatus');
      this.streaming = streamStatus.outputActive;
      this.uptime = streamStatus.outputTimecode ? streamStatus.outputTimecode.split('.')[0] : '00:00:00';

      const recordStatus = await this.obs.call('GetRecordStatus');
      this.recording = recordStatus.outputActive;

      // Start polling
      this.startPolling();
    } catch (err) {
      console.error(`[OBS] Error reading initial settings: ${err.message}`);
      // Even if settings failed, still start polling
      this.startPolling();
    }
  }

  onDisconnect() {
    console.log(`[OBS] [${new Date().toLocaleString()}] Connection closed.`);
    this.connected = false;
    this.streaming = false;
    this.recording = false;
    this.uptime = '00:00:00';
    this.bitrate = 0;
    this.lastBytes = undefined;
    this.lastBytesTime = undefined;
    this.stopPolling();
    this.emit('status', { connected: false });
    this.triggerReconnect();
  }

  onError(err) {
    console.error(`[OBS] Socket error: ${err.message}`);
  }

  onStreamStateChanged(data) {
    // StreamStateChanged payload contains outputActive (boolean) and outputState (string)
    this.streaming = data.outputActive;
    console.log(`[OBS] Stream state changed: active = ${this.streaming}, state = ${data.outputState}`);
    if (!this.streaming) {
      this.uptime = '00:00:00';
      this.bitrate = 0;
      this.lastBytes = undefined;
      this.lastBytesTime = undefined;
    }
    this.emit('stats', this.getStats());
  }

  onRecordStateChanged(data) {
    this.recording = data.outputActive;
    console.log(`[OBS] Record state changed: active = ${this.recording}, state = ${data.outputState}`);
    this.emit('stats', this.getStats());
  }

  startPolling(intervalMs = 2000) {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }
    this.pollingTimer = setInterval(() => this.poll(), intervalMs);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  async poll() {
    if (!this.connected) return;

    try {
      const [streamStatus, stats] = await Promise.all([
        this.obs.call('GetStreamStatus'),
        this.obs.call('GetStats')
      ]);

      // Update active state
      this.streaming = streamStatus.outputActive;

      // Handle Uptime
      if (this.streaming && streamStatus.outputTimecode) {
        this.uptime = streamStatus.outputTimecode.split('.')[0];
      } else {
        this.uptime = '00:00:00';
      }

      // Handle Bitrate
      const now = Date.now();
      const currentBytes = streamStatus.outputBytes || 0;
      if (this.streaming && currentBytes > 0) {
        if (this.lastBytes !== undefined && this.lastBytesTime !== undefined) {
          const bytesDiff = currentBytes - this.lastBytes;
          const intervalSeconds = (now - this.lastBytesTime) / 1000;
          if (intervalSeconds > 0) {
            this.bitrate = Math.round(((bytesDiff * 8) / intervalSeconds) / 1000);
          }
        } else {
          this.bitrate = 0;
        }
        this.lastBytes = currentBytes;
        this.lastBytesTime = now;
      } else {
        this.bitrate = 0;
        this.lastBytes = undefined;
        this.lastBytesTime = undefined;
      }

      // Handle Dropped Frames (outputSkippedFrames / outputTotalFrames)
      this.droppedFrames = stats.outputSkippedFrames || 0;
      this.totalFrames = stats.outputTotalFrames || 0;
      if (this.totalFrames > 0) {
        this.droppedFramesPct = ((this.droppedFrames / this.totalFrames) * 100).toFixed(1);
      } else {
        this.droppedFramesPct = '0.0';
      }

      // Emit stats event
      this.emit('stats', this.getStats());
    } catch (err) {
      console.error(`[OBS] Poll error: ${err.message}`);
      // Don't crash the server, just let the next poll try again
    }
  }

  getStats() {
    return {
      connected: this.connected,
      streaming: this.streaming,
      recording: this.recording,
      uptime: this.uptime,
      bitrate: this.bitrate,
      droppedFrames: this.droppedFrames,
      droppedFramesPct: this.droppedFramesPct,
      totalFrames: this.totalFrames,
      resolution: this.resolution,
      fps: this.fps,
      connectedOverlays: this.connectedOverlays
    };
  }
}

module.exports = OBSMonitor;
