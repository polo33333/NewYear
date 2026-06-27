// ── Utilities Module ─────────────────────────────────────────────────────────
// Cung cấp các hàm toán học hỗ trợ nội suy mượt mà (lerp, spring) và biến đổi màu.

window.MusicVisualizerUtils = {
  // Nội suy tuyến tính (Linear Interpolation)
  lerp: function (start, end, amt) {
    return (1 - amt) * start + amt * end;
  },

  // Giới hạn giá trị trong khoảng [min, max]
  clamp: function (val, min, max) {
    return Math.max(min, Math.min(max, val));
  },

  // Bộ lọc làm mượt kiểu lò xo (Spring easing)
  spring: function (current, target, velocity, tension, damping) {
    const force = (target - current) * tension;
    const acceleration = force - velocity * damping;
    const newVelocity = velocity + acceleration;
    const newPosition = current + newVelocity;
    return { pos: newPosition, vel: newVelocity };
  },

  // Chuyển đổi mã hex sang RGB string hoặc CSS rgba
  hexToRgb: function (hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  },

  hexToRgbaStr: function (hex, alpha) {
    const rgb = this.hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }
};
