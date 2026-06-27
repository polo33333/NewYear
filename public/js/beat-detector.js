// ── Beat Detector Module ─────────────────────────────────────────────────────
// Phát hiện nhịp trống thời gian thực để tạo xung phát sáng cực nhẹ cho nền.

window.BeatDetector = class BeatDetector {
  constructor(config = window.VisualizerConfig) {
    this.config = config;
    this.beatThreshold = config.beatThreshold;
    this.beatCutoff = 0;
    this.historySize = 30;
    this.history = new Float32Array(this.historySize);
    this.historyIndex = 0;
    
    this.isBeat = false;
    this.beatStrength = 0;
  }

  detect(timeData, freqData) {
    this.isBeat = false;
    if (!timeData || !freqData || timeData.length === 0) {
      this.beatStrength = window.MusicVisualizerUtils.lerp(this.beatStrength, 0, 0.1);
      return false;
    }

    // 1. Tính RMS
    let sumSquares = 0;
    for (let i = 0; i < timeData.length; i++) {
      const normalized = (timeData[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / timeData.length);

    // 2. Tính năng lượng dải trầm Bass (FFT bins 0-8)
    let bassEnergy = 0;
    const bassBinCount = Math.min(8, freqData.length);
    for (let i = 0; i < bassBinCount; i++) {
      bassEnergy += freqData[i] / 255;
    }
    bassEnergy = bassEnergy / bassBinCount;

    // 3. Trung bình cộng lịch sử Bass
    let sumHistory = 0;
    for (let i = 0; i < this.historySize; i++) {
      sumHistory += this.history[i];
    }
    const avgBassEnergy = sumHistory / this.historySize;

    this.history[this.historyIndex] = bassEnergy;
    this.historyIndex = (this.historyIndex + 1) % this.historySize;

    const currentCutoff = avgBassEnergy * this.beatThreshold;
    
    if (rms > this.config.beatMinVolume && bassEnergy > currentCutoff && bassEnergy > this.beatCutoff) {
      this.isBeat = true;
      this.beatStrength = window.MusicVisualizerUtils.clamp((bassEnergy - currentCutoff) * 3 + 1.0, 1.0, 1.5);
      this.beatCutoff = bassEnergy * 1.1;
    } else {
      this.beatStrength = window.MusicVisualizerUtils.lerp(this.beatStrength, 0, 0.08);
      this.beatCutoff = Math.max(avgBassEnergy * this.beatThreshold, this.beatCutoff * this.config.beatDecayRate);
    }

    return this.isBeat;
  }
};
