// ── Visualizer Module ────────────────────────────────────────────────────────
// Dựng hình Canvas 60 cột màu cầu vồng y hệt bản cũ với chuyển động mượt mà và hiệu ứng đỉnh rơi.

window.MusicVisualizer = class MusicVisualizer {
  constructor(canvasElement, config = window.VisualizerConfig, theme = window.MusicVisualizerTheme) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.config = config;
    this.theme = theme;
    
    this.smoothedBars = new Float32Array(config.barCount).fill(2);
    this.peaks = new Float32Array(config.barCount).fill(2);
    this.peakHoldCounters = new Int32Array(config.barCount);
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx.scale(dpr, dpr);
  }

  render(isBeat, beatStrength, freqData, isPaused) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    
    // Xóa màn hình tạo cảm giác sắc nét
    ctx.clearRect(0, 0, w, h);
    
    // 1. Vẽ nền phát sáng nhẹ nhàng phản ứng theo nhịp (Subtle Beat Glow)
    if (!isPaused && beatStrength > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const glowGrad = ctx.createRadialGradient(w / 2, h, 10, w / 2, h, w * 0.5);
      const alpha = window.MusicVisualizerUtils.clamp(beatStrength * 0.08, 0, 0.12);
      glowGrad.addColorStop(0, `rgba(0, 245, 255, ${alpha})`);
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    
    const barCount = this.config.barCount;
    const gap = 2; // khoảng cách giữa các cột giống hệt bản cũ
    const barWidth = (w - (barCount - 1) * gap) / barCount;

    for (let i = 0; i < barCount; i++) {
      let targetHeight = 2;
      
      if (!isPaused && freqData && freqData.length > 0) {
        // 2. Ánh xạ Logarithmic từ dải tần số tuyến tính để dàn trải tự nhiên hơn
        const logPercent = Math.pow(i / (barCount - 1), 1.8);
        const centerBin = Math.floor(logPercent * (freqData.length - 2) + 1);
        
        // Trung bình cộng nhiều bins lân cận để lọc mượt dải âm
        const binStart = Math.max(0, centerBin - 1);
        const binEnd = Math.min(freqData.length - 1, centerBin + 1);
        let val = 0;
        for (let b = binStart; b <= binEnd; b++) {
          val += freqData[b];
        }
        val = val / (binEnd - binStart + 1);
        
        // Treble Boost: Âm cao tự nhiên yếu hơn âm trầm. 
        // Nhân thêm hệ số tăng dần về bên phải để dải Treble nẩy sống động.
        const trebleBoost = 1.0 + (i / (barCount - 1)) * 0.75;
        const normalized = (val / 255) * this.config.sensitivity * trebleBoost;
        targetHeight = Math.max(2, Math.min(normalized * h * 0.9, h - 4));
      }

      // 3. Adaptive Smoothing (Lên nhanh, hạ xuống chậm)
      if (isPaused) {
        // Lắng xuống chậm khi tạm dừng nhạc thay vì tụt xuống lập tức
        this.smoothedBars[i] = window.MusicVisualizerUtils.lerp(this.smoothedBars[i], 2, 0.08);
      } else {
        if (targetHeight > this.smoothedBars[i]) {
          this.smoothedBars[i] = this.smoothedBars[i] * 0.2 + targetHeight * 0.8;
        } else {
          this.smoothedBars[i] = this.smoothedBars[i] * this.config.smoothing + targetHeight * (1 - this.config.smoothing);
        }
      }

      const barHeight = this.smoothedBars[i];
      
      // Tính toán tọa độ nguyên pixel để tránh mờ do răng cưa (anti-aliasing subpixel)
      const xLeft = Math.round(i * (barWidth + gap));
      const xRight = Math.round(i * (barWidth + gap) + barWidth);
      const exactWidth = Math.max(1, xRight - xLeft);
      
      const yBottom = h;
      const yTop = Math.round(yBottom - barHeight);
      const exactHeight = Math.max(2, yBottom - yTop);

      // 3. Phối màu cầu vồng (Rainbow HSL) và phát sáng giống hệt CSS cũ
      const hue = Math.round((i / barCount) * 280);
      const color = `hsl(${hue}, 100%, 60%)`;
      ctx.fillStyle = color;
      
      ctx.shadowBlur = this.config.glowStrength;
      ctx.shadowColor = color;

      // Vẽ hình chữ nhật bo góc sắc nét
      ctx.beginPath();
      ctx.roundRect(xLeft, yTop, exactWidth, exactHeight, [2, 2, 0, 0]);
      ctx.fill();

      // 4. Vẽ đỉnh cột rơi chậm (Peak Hold) rực rỡ và tinh tế nếu được kích hoạt
      if (this.config.enablePeak) {
        if (barHeight >= this.peaks[i]) {
          this.peaks[i] = barHeight;
          this.peakHoldCounters[i] = this.config.peakHoldFrames;
        } else {
          if (this.peakHoldCounters[i] > 0) {
            this.peakHoldCounters[i]--;
          } else {
            this.peaks[i] = Math.max(2, this.peaks[i] - this.config.peakDecay);
          }
        }
        
        const peakDrawY = Math.round(yBottom - this.peaks[i]);
        const xCenter = xLeft + exactWidth / 2;
        
        ctx.shadowBlur = 3;
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(xCenter, Math.max(1, peakDrawY - 1.5), 1.0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
};
