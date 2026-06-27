// ── Theme and Config Module ──────────────────────────────────────────────────
// Cấu hình thông số trực quan cho bộ hiển thị Canvas.

window.MusicVisualizerTheme = {
  primary: '#00f5ff',
  secondary: '#bd00ff',
  accent: '#ffffff'
};

window.VisualizerConfig = {
  barCount: 60,             // Giữ nguyên đúng 60 cột như bản cũ
  sensitivity: 1.5,        // Độ nhạy cột
  smoothing: 0.78,          // Hằng số làm mượt dải tần

  // Chỉ báo đỉnh cột (Peak Hold)
  enablePeak: false,
  peakDecay: 0.18,          // Tốc độ rơi của đỉnh chấm
  peakHoldFrames: 25,       // Số khung hình giữ đỉnh trước khi rơi

  // Độ mờ chuyển động và phát sáng
  motionBlur: 0.25,         // Hệ số xóa màn hình (thấp = nhiều vệt mượt)
  glowStrength: 6,          // Độ tỏa sáng (bản cũ dùng box-shadow: 0 0 6px)

  // Phát hiện nhịp nền (Beat Detection)
  beatThreshold: 1.12,
  beatDecayRate: 0.98,
  beatMinVolume: 0.08
};
