/**
 * MATRIX HUD - Interactive Onboarding Tour System
 */

(function () {
  const STORAGE_KEY = 'matrix_hud_control_tour_seen';

  const TOUR_STEPS = [
    {
      target: '#app-sidebar',
      title: 'Thanh điều hướng Sidebar',
      icon: 'fa-solid fa-bars',
      content: 'Chuyển đổi nhanh giữa các khu vực chức năng: Điều khiển livestream, Quản lý Nhân vật, Vũ khí, Lịch sử trận đấu và Cài đặt hệ thống.',
      preferredPos: 'right'
    },
    {
      target: '.scenes-panel .sp-section:nth-child(1)',
      title: 'Chế độ hiển thị (Scenes)',
      icon: 'fa-solid fa-layer-group',
      content: 'Chuyển nhanh trạng thái giao diện Overlay trên livestream: <b>Trận đấu</b>, <b>Nghỉ giải lao</b>, <b>Tổng kết</b> hoặc <b>Kết thúc</b>.',
      preferredPos: 'right'
    },
    {
      target: '.scenes-panel .sp-section:nth-child(3)',
      title: 'Hiển thị thành phần (Overlays)',
      icon: 'fa-solid fa-toggle-on',
      content: 'Bật hoặc tắt nhanh các lớp giao diện hiển thị trên màn hình livestream như Bảng điểm, Thông tin bài hát,...',
      preferredPos: 'right'
    },
    {
      target: '.scenes-panel .sp-section:nth-child(5)',
      title: 'Đường dẫn OBS Links',
      icon: 'fa-solid fa-link',
      content: 'Nơi sao chép các liên kết Browser Source để dán trực tiếp vào phần mềm OBS Studio hoặc Streamlabs Desktop.',
      preferredPos: 'right'
    },
    {
      target: '#sp-music-section',
      title: 'Trình phát nhạc',
      icon: 'fa-solid fa-music',
      content: 'Chọn tệp nhạc trực tiếp từ máy tính để phát nhạc nền livestream và tự động hiển thị tên bài hát lên màn hình.',
      preferredPos: 'right'
    },
    {
      target: '.preview-section',
      title: 'Màn hình xem trước (Live Preview)',
      icon: 'fa-solid fa-display',
      content: 'Xem trực tiếp toàn bộ giao diện Overlay phát sóng theo thời gian thực (Real-time) ngay trên màn hình điều khiển.',
      preferredPos: 'bottom'
    },
    {
      target: '.system-monitor-box',
      title: 'Thông tin kết nối & Độ trễ',
      icon: 'fa-solid fa-earth-asia',
      content: 'Biểu đồ theo dõi độ trễ (Ping) và ổn định của kết nối WebSocket giữa bảng điều khiển và màn hình Overlay.',
      preferredPos: 'bottom'
    },
    {
      target: '.match-controls-box',
      title: 'Thông tin trận đấu',
      icon: 'fa-solid fa-sliders',
      content: 'Cập nhật tên 2 đội đấu, nhập tiêu đề giải đấu và bộ đếm ngược thời gian nghỉ.',
      preferredPos: 'left'
    },
    {
      target: '.roster-panel',
      title: 'Đội hình & Vũ khí',
      icon: 'fa-brands fa-gg',
      content: 'Quản lý và chọn lựa danh sách Nhân vật cùng Vũ khí trang bị cho từng Round đấu của Team Xanh và Team Đỏ.',
      preferredPos: 'top'
    }
  ];

  class ControlTour {
    constructor() {
      this.currentStep = 0;
      this.active = false;
      this.overlayEl = null;
      this.spotlightEl = null;
      this.popoverEl = null;
      this.handleResize = this.handleResize.bind(this);
      this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    start(force = false) {
      if (this.active) return;

      if (!force && localStorage.getItem(STORAGE_KEY)) {
        return;
      }

      this.active = true;
      this.currentStep = 0;
      this.createDOM();
      this.showStep(this.currentStep);

      window.addEventListener('resize', this.handleResize);
      window.addEventListener('keydown', this.handleKeyDown);
    }

    createDOM() {
      // Create dark backdrop
      this.overlayEl = document.createElement('div');
      this.overlayEl.className = 'tour-overlay';
      document.body.appendChild(this.overlayEl);

      // Create spotlight border box
      this.spotlightEl = document.createElement('div');
      this.spotlightEl.className = 'tour-spotlight';
      document.body.appendChild(this.spotlightEl);

      // Create popover box
      this.popoverEl = document.createElement('div');
      this.popoverEl.className = 'tour-popover';
      this.popoverEl.innerHTML = `
        <div class="tour-arrow"></div>
        <div class="tour-popover-header">
          <div class="tour-popover-title" id="tour-title">
            <i class="fa-solid fa-circle-info"></i> <span>Tiêu đề</span>
          </div>
          <span class="tour-step-badge" id="tour-badge">1/9</span>
        </div>
        <div class="tour-popover-body" id="tour-content">Nội dung hướng dẫn...</div>
        <div class="tour-popover-footer">
          <button class="tour-btn tour-btn-skip" id="tour-btn-skip">Bỏ qua</button>
          <div class="tour-nav-group">
            <button class="tour-btn tour-btn-prev" id="tour-btn-prev"><i class="fa-solid fa-chevron-left"></i> Quay lại</button>
            <button class="tour-btn tour-btn-next" id="tour-btn-next">Tiếp theo <i class="fa-solid fa-chevron-right"></i></button>
          </div>
        </div>
      `;
      document.body.appendChild(this.popoverEl);

      // Bind events
      document.getElementById('tour-btn-skip').onclick = () => this.finish(true);
      document.getElementById('tour-btn-prev').onclick = () => this.prev();
      document.getElementById('tour-btn-next').onclick = () => this.next();
      this.overlayEl.onclick = () => this.finish(true);
    }

    showStep(index) {
      if (index < 0 || index >= TOUR_STEPS.length) return;
      this.currentStep = index;

      const step = TOUR_STEPS[index];
      const targetEl = document.querySelector(step.target);

      if (!targetEl) {
        console.warn(`[ControlTour] Target not found: ${step.target}`);
        // Skip step if target element missing
        if (index + 1 < TOUR_STEPS.length) {
          this.showStep(index + 1);
        } else {
          this.finish();
        }
        return;
      }

      // Scroll target into view if needed
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

      // Update Popover contents
      document.getElementById('tour-title').innerHTML = `<i class="${step.icon}"></i> <span>${step.title}</span>`;
      document.getElementById('tour-badge').textContent = `${index + 1}/${TOUR_STEPS.length}`;
      document.getElementById('tour-content').innerHTML = step.content;

      const prevBtn = document.getElementById('tour-btn-prev');
      const nextBtn = document.getElementById('tour-btn-next');

      prevBtn.disabled = index === 0;

      if (index === TOUR_STEPS.length - 1) {
        nextBtn.className = 'tour-btn tour-btn-finish';
        nextBtn.innerHTML = '<i class="fa-solid fa-check"></i> Hoàn thành';
      } else {
        nextBtn.className = 'tour-btn tour-btn-next';
        nextBtn.innerHTML = 'Tiếp theo <i class="fa-solid fa-chevron-right"></i>';
      }

      // Position spotlight & popover after slight DOM layout frame
      requestAnimationFrame(() => {
        this.positionSpotlightAndPopover(targetEl, step.preferredPos);
        this.popoverEl.classList.add('active');
      });
    }

    positionSpotlightAndPopover(targetEl, preferredPos = 'bottom') {
      const rect = targetEl.getBoundingClientRect();
      const padding = 6;

      const top = Math.max(0, rect.top - padding);
      const left = Math.max(0, rect.left - padding);
      const width = rect.width + (padding * 2);
      const height = rect.height + (padding * 2);

      // Update Spotlight position
      this.spotlightEl.style.top = `${top}px`;
      this.spotlightEl.style.left = `${left}px`;
      this.spotlightEl.style.width = `${width}px`;
      this.spotlightEl.style.height = `${height}px`;

      // Position Popover
      const popoverRect = this.popoverEl.getBoundingClientRect();
      const popWidth = popoverRect.width || 360;
      const popHeight = popoverRect.height || 180;
      const margin = 14;

      let popTop = 0;
      let popLeft = 0;
      let pos = preferredPos;

      // Smart flip position if overflowing viewport
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      if (pos === 'right' && left + width + popWidth + margin > windowWidth) {
        pos = left > popWidth + margin ? 'left' : 'bottom';
      }
      if (pos === 'left' && left - popWidth - margin < 0) {
        pos = left + width + popWidth + margin < windowWidth ? 'right' : 'bottom';
      }
      if (pos === 'bottom' && top + height + popHeight + margin > windowHeight) {
        pos = top > popHeight + margin ? 'top' : 'right';
      }
      if (pos === 'top' && top - popHeight - margin < 0) {
        pos = top + height + popHeight + margin < windowHeight ? 'bottom' : 'right';
      }

      switch (pos) {
        case 'top':
          popTop = top - popHeight - margin;
          popLeft = left + (width / 2) - (popWidth / 2);
          break;
        case 'bottom':
          popTop = top + height + margin;
          popLeft = left + (width / 2) - (popWidth / 2);
          break;
        case 'left':
          popTop = top + (height / 2) - (popHeight / 2);
          popLeft = left - popWidth - margin;
          break;
        case 'right':
        default:
          popTop = top + (height / 2) - (popHeight / 2);
          popLeft = left + width + margin;
          break;
      }

      // Constrain within viewport padding
      popLeft = Math.max(16, Math.min(popLeft, windowWidth - popWidth - 16));
      popTop = Math.max(16, Math.min(popTop, windowHeight - popHeight - 16));

      this.popoverEl.setAttribute('data-position', pos);
      this.popoverEl.style.top = `${popTop}px`;
      this.popoverEl.style.left = `${popLeft}px`;
    }

    next() {
      if (this.currentStep + 1 < TOUR_STEPS.length) {
        this.showStep(this.currentStep + 1);
      } else {
        this.finish();
      }
    }

    prev() {
      if (this.currentStep > 0) {
        this.showStep(this.currentStep - 1);
      }
    }

    finish(skipped = false) {
      localStorage.setItem(STORAGE_KEY, 'true');
      this.active = false;

      window.removeEventListener('resize', this.handleResize);
      window.removeEventListener('keydown', this.handleKeyDown);

      if (this.popoverEl) this.popoverEl.remove();
      if (this.spotlightEl) this.spotlightEl.remove();
      if (this.overlayEl) this.overlayEl.remove();

      if (!skipped && typeof window.showToast === 'function') {
        window.showToast('Đã hoàn thành hướng dẫn sử dụng!', 'success');
      }
    }

    handleResize() {
      if (!this.active) return;
      const step = TOUR_STEPS[this.currentStep];
      if (step) {
        const targetEl = document.querySelector(step.target);
        if (targetEl) {
          this.positionSpotlightAndPopover(targetEl, step.preferredPos);
        }
      }
    }

    handleKeyDown(e) {
      if (!this.active) return;
      if (e.key === 'Escape') {
        this.finish(true);
      } else if (e.key === 'ArrowRight') {
        this.next();
      } else if (e.key === 'ArrowLeft') {
        this.prev();
      }
    }
  }

  // Global Instance & Public Helper
  const tourInstance = new ControlTour();

  window.startControlTour = function (force = true) {
    tourInstance.start(force);
  };

  window.initControlTourAuto = function () {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setTimeout(() => {
        tourInstance.start(false);
      }, 1000);
    }
  };
})();
