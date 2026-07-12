if (localStorage.getItem('kdone_auth_token')) {
  window.location.href = '/';
}

const pwInput = document.getElementById('password');
const toggleBtn = document.getElementById('btn-toggle');
const toggleIcon = document.getElementById('toggle-icon');
if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    const show = pwInput.type === 'password';
    pwInput.type = show ? 'text' : 'password';
    toggleIcon.className = show ? 'fas fa-eye' : 'fas fa-eye-slash';
  });
}

async function doLogin() {
  const u = document.getElementById('username').value.trim();
  const p = document.getElementById('password').value;
  if (!u || !p) { showError('Vui lòng điền đầy đủ tài khoản và mật khẩu!'); return; }

  const btn = document.getElementById('btn-login');
  const spinner = document.getElementById('btn-spinner');
  const btnText = document.getElementById('btn-text');
  const btnArrow = document.getElementById('btn-arrow');

  btn.disabled = true;
  spinner.style.display = 'block';
  btnText.innerText = 'Đang xác thực...';
  btnArrow.style.display = 'none';
  document.getElementById('error-msg').style.display = 'none';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('kdone_auth_token', data.token);
      localStorage.setItem('kdone_user_id', data.user.id);
      localStorage.setItem('kdone_username', data.user.username);
      localStorage.setItem('kdone_is_admin', data.user.isAdmin ? 'true' : 'false');
      setTimeout(() => { window.location.href = '/'; }, 400);
    } else {
      showError(data.message || 'Tài khoản hoặc mật khẩu không đúng!');
      resetBtn();
    }
  } catch {
    showError('Lỗi kết nối máy chủ, vui lòng thử lại sau!');
    resetBtn();
  }
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.style.display = 'flex';
  document.getElementById('error-text').innerText = msg;
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = null;
}

function resetBtn() {
  const btn = document.getElementById('btn-login');
  btn.disabled = false;
  document.getElementById('btn-spinner').style.display = 'none';
  document.getElementById('btn-text').innerText = 'Truy cập Hệ thống';
  document.getElementById('btn-arrow').style.display = '';
}

// Binary numbers floating up effect (Hacker effect)
(() => {
  const canvas = document.getElementById('binary-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width = canvas.width = canvas.offsetWidth;
  let height = canvas.height = canvas.offsetHeight;

  window.addEventListener('resize', () => {
    width = canvas.width = canvas.offsetWidth;
    height = canvas.height = canvas.offsetHeight;
  });

  const particles = [];
  const maxParticles = 130;

  class Particle {
    constructor() {
      this.reset(true);
    }

    reset(init = false) {
      this.x = Math.random() * width;
      this.y = init ? Math.random() * height : height + Math.random() * 50 + 10;
      this.speed = Math.random() * 1.6 + 0.4;
      this.fontSize = Math.random() * 13 + 9;
      this.opacity = Math.random() * 0.22 + 0.03;
      this.value = Math.random() > 0.5 ? '1' : '0';
      this.changeInterval = Math.floor(Math.random() * 25) + 12;
      this.counter = 0;
    }

    update() {
      this.y -= this.speed;
      this.counter++;
      if (this.counter >= this.changeInterval) {
        this.value = Math.random() > 0.5 ? '1' : '0';
        this.counter = 0;
      }
      if (this.y < -30) {
        this.reset(false);
      }
    }

    draw() {
      const isLight = document.body.getAttribute('data-ui-mode') === 'light';
      const colorStr = isLight ? `rgba(91, 106, 240, ${this.opacity * 1.5})` : `rgba(0, 255, 231, ${this.opacity})`;
      ctx.fillStyle = colorStr;
      ctx.font = `${this.fontSize}px 'Outfit', sans-serif`;
      ctx.fillText(this.value, this.x, this.y);
    }
  }

  for (let i = 0; i < maxParticles; i++) {
    particles.push(new Particle());
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    requestAnimationFrame(animate);
  }

  animate();
})();

// Background Slideshow Carousel Logic
const slidesData = [
  {
    image: 'images/other/bg-1.webp',
    title: 'Đồi Nam Viên',
    subtitle: 'ĐỒI NAM VIÊN',
    desc: 'Nằm ở phía nam vùng đất Xuanfang và tiếp giáp với cửa ngõ kết nối lãnh thổ này với thế giới bên ngoài. Nơi đây có trạm gác Shaftpost Yard, trạm kiểm tra toàn bộ hàng hóa và lữ khách qua lại khu vực dưới sự quản lý của Bộ Ngoại giao.'
  },
  {
    image: 'images/other/bg-2.webp',
    title: 'Đỉnh Tây Phương',
    subtitle: 'ĐỈNH TÂY PHƯƠNG',
    desc: 'Nằm ở phía tây vùng đất Xuanfang, nơi tọa lạc của tổ hợp công xưởng cơ khí Skyworks. Skyworks bao gồm xưởng đúc Thousandfold chuyên chế tạo Autopuppet và bẫy Myriad Snare có nhiệm vụ tiêu diệt các Tacet Discord hùng mạnh. Hai cơ sở này hoạt động không ngừng nghỉ ngày đêm để hỗ trợ và bảo vệ pháo đài Xuanfang.'
  },
  {
    image: 'images/other/bg-3.webp',
    title: 'Đỉnh Đông Huyền',
    subtitle: 'ĐỈNH ĐÔNG HUYỀN',
    desc: 'Vùng núi non rậm rạp chìm trong sương mù nằm ở phía đông vùng đất Xuanfang. Nơi đây có tòa tháp Fogveil Pagoda như một mê cung phức tạp tỏa ra sương mù gây mất phương hướng quanh năm. Làn sương chứa các tần số đặc biệt làm hỗn loạn Tacet Discord và dẫn dụ chúng vào bẫy.'
  },
  {
    image: 'images/other/bg-4.webp',
    title: 'Pháo Đài Xuanfang',
    subtitle: 'PHÁO ĐÀI XUANFANG',
    desc: 'Một pháo đài cơ khí treo dưới sự quản lý của Mengzhou, nơi chứa các Tacet Discord được chuyển hướng từ đợt bùng phát Norfall Barren. Được thiết kế tinh vi, nó phân tách và cô lập các đợt tấn công của Tacet Discord thông qua một hệ thống cơ chế khổng lồ. Hình dạng của nó có thể thay đổi tùy ý, triển khai các autopuppet để luân phiên phòng thủ, thanh trừng hoặc trấn áp các Tacet Discord bị giam giữ bên trong.'
  }
];

let currentSlide = 0;
const slideDuration = 7000; // 7 seconds per slide
let lastTime = Date.now();
let animFrameId = null;
let isPaused = false;
let progress = 0;

const bgSlides = document.querySelectorAll('.bg-slide');
const thumbnails = document.querySelectorAll('.carousel-thumbnails .thumb');
const locTextWrap = document.getElementById('location-text-wrap');
const locSubtitle = document.getElementById('loc-subtitle');
const locTitle = document.getElementById('loc-title');
const locDesc = document.getElementById('loc-desc');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressPercent = document.getElementById('progress-percent');

function setSlide(index) {
  if (index === currentSlide) return;

  // Update active classes for slides
  bgSlides[currentSlide].classList.remove('active');
  thumbnails[currentSlide].classList.remove('active');

  currentSlide = index;

  bgSlides[currentSlide].classList.add('active');
  thumbnails[currentSlide].classList.add('active');

  // Animate text changes
  locTextWrap.classList.add('fade-out');
  setTimeout(() => {
    locSubtitle.innerText = slidesData[currentSlide].subtitle;
    locTitle.innerText = slidesData[currentSlide].title;
    locDesc.innerText = slidesData[currentSlide].desc;
    locTextWrap.classList.remove('fade-out');
  }, 400);

  // Reset progress
  progress = 0;
  progressBarFill.style.width = '0%';
  if (progressPercent) progressPercent.innerText = '0%';
  lastTime = Date.now();
}

function nextSlide() {
  let next = (currentSlide + 1) % slidesData.length;
  setSlide(next);
}

function prevSlide() {
  let prev = (currentSlide - 1 + slidesData.length) % slidesData.length;
  setSlide(prev);
}

function tick() {
  if (!isPaused) {
    const now = Date.now();
    const delta = now - lastTime;
    lastTime = now;

    progress += (delta / slideDuration) * 100;
    if (progress >= 100) {
      progress = 0;
      if (progressPercent) progressPercent.innerText = '0%';
      nextSlide();
    } else {
      progressBarFill.style.width = `${progress}%`;
      if (progressPercent) progressPercent.innerText = `${Math.min(100, Math.round(progress))}%`;
    }
  } else {
    lastTime = Date.now();
  }
  animFrameId = requestAnimationFrame(tick);
}

// Pause on hover
const carouselControls = document.querySelector('.carousel-controls');
if (carouselControls) {
  carouselControls.addEventListener('mouseenter', () => { isPaused = true; });
  carouselControls.addEventListener('mouseleave', () => { isPaused = false; lastTime = Date.now(); });
}

// Start tick
animFrameId = requestAnimationFrame(tick);

// Initialize first slide texts
if (locSubtitle && locTitle && locDesc && slidesData[0]) {
  locSubtitle.innerText = slidesData[0].subtitle;
  locTitle.innerText = slidesData[0].title;
  locDesc.innerText = slidesData[0].desc;
}

// Falling bamboo leaves effect
(() => {
  const canvas = document.getElementById('leaves-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width = canvas.width = canvas.offsetWidth;
  let height = canvas.height = canvas.offsetHeight;

  window.addEventListener('resize', () => {
    width = canvas.width = canvas.offsetWidth;
    height = canvas.height = canvas.offsetHeight;
  });

  const leaves = [];
  const maxLeaves = 25; // Subtle amount of leaves

  class Leaf {
    constructor() {
      this.reset(true);
    }

    reset(init = false) {
      this.x = Math.random() * width;
      this.y = init ? Math.random() * height : -20;
      this.size = Math.random() * 12 + 8;
      this.speedY = Math.random() * 0.8 + 0.5;
      this.speedX = Math.random() * 0.4 - 0.2;
      this.rotation = Math.random() * Math.PI * 2;
      this.spinSpeed = Math.random() * 0.02 - 0.01;
      this.opacity = Math.random() * 0.3 + 0.1;
    }

    update() {
      this.y += this.speedY;
      this.x += this.speedX + Math.sin(this.y / 30) * 0.2; // Add subtle sway
      this.rotation += this.spinSpeed;
      if (this.y > height + 20 || this.x < -20 || this.x > width + 20) {
        this.reset(false);
      }
    }

    draw() {
      const isLight = document.body.getAttribute('data-ui-mode') === 'light';
      // Soft cyan-green for dark mode, soft blue-green for light mode
      const baseColor = isLight ? 'rgba(59, 130, 246, ' : 'rgba(0, 255, 231, ';

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.beginPath();
      // Draw a stylized bamboo leaf shape
      ctx.moveTo(0, -this.size);
      ctx.quadraticCurveTo(this.size * 0.25, 0, 0, this.size);
      ctx.quadraticCurveTo(-this.size * 0.25, 0, 0, -this.size);
      ctx.fillStyle = baseColor + this.opacity + ')';
      ctx.fill();
      ctx.restore();
    }
  }

  for (let i = 0; i < maxLeaves; i++) {
    leaves.push(new Leaf());
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);
    leaves.forEach(l => {
      l.update();
      l.draw();
    });
    requestAnimationFrame(animate);
  }

  animate();
})();
