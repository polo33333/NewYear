// ── KDSTREAM Music Player ─────────────────────────────────────────────────────
// 100% client-side: reads files from user's PC via File API, streams via blob URLs.
// No server upload, no internet required.

const mp = {
  audio: new Audio(),
  playlist: [],        // Array of { name, url, duration }
  currentIndex: -1,
  shuffle: false,
  repeat: false,       // 'none' | 'one' | 'all'
  repeatMode: 'none',
  shuffleOrder: [],
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function mpFmt(sec) {
  if (!isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = String(Math.floor(sec % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

function mpEl(id) { return document.getElementById(id); }

// ── Load files from folder input ─────────────────────────────────────────────
window.musicPlayerLoadFiles = function (files) {
  // Revoke old blob URLs to free memory
  mp.playlist.forEach(t => URL.revokeObjectURL(t.url));
  mp.playlist = [];
  mp.currentIndex = -1;

  const audioExts = /\.(mp3|wav|ogg|flac|m4a|aac|opus|weba)$/i;
  const tracks = Array.from(files).filter(f => audioExts.test(f.name));

  if (!tracks.length) {
    renderPlaylist();
    return;
  }

  // Sort alphabetically
  tracks.sort((a, b) => a.name.localeCompare(b.name));

  mp.playlist = tracks.map(f => ({
    name: f.name.replace(/\.[^.]+$/, ''), // strip extension
    url: URL.createObjectURL(f),
    duration: 0
  }));

  // Pre-fetch durations
  mp.playlist.forEach((track, i) => {
    const tmp = new Audio();
    tmp.src = track.url;
    tmp.addEventListener('loadedmetadata', () => {
      mp.playlist[i].duration = tmp.duration;
      // Re-render to update duration label
      const row = mpEl(`mp-row-${i}`);
      if (row) row.querySelector('.mp-dur').textContent = mpFmt(tmp.duration);
    });
  });

  buildShuffleOrder();
  renderPlaylist();
  mpLoad(0);
};

// ── Build shuffle order ───────────────────────────────────────────────────────
function buildShuffleOrder() {
  mp.shuffleOrder = mp.playlist.map((_, i) => i);
  if (mp.shuffle) {
    for (let i = mp.shuffleOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mp.shuffleOrder[i], mp.shuffleOrder[j]] = [mp.shuffleOrder[j], mp.shuffleOrder[i]];
    }
  }
}

// ── Load a track by playlist index ───────────────────────────────────────────
function mpLoad(index) {
  if (!mp.playlist.length) return;
  index = Math.max(0, Math.min(index, mp.playlist.length - 1));
  mp.currentIndex = index;

  const track = mp.playlist[index];
  mp.audio.src = track.url;
  mp.audio.volume = (parseInt(localStorage.getItem('music-player-volume') ?? '80', 10)) / 100;
  mp.audio.load();

  // UI update
  const nameEl = mpEl('music-track-name');
  if (nameEl) {
    nameEl.textContent = track.name;
    nameEl.classList.remove('marquee-active');
    requestAnimationFrame(() => {
      if (nameEl.scrollWidth > nameEl.clientWidth) {
        nameEl.classList.add('marquee-active');
      }
    });
  }

  const miniName = mpEl('mini-track-name');
  if (miniName) {
    miniName.textContent = track.name;
    miniName.classList.remove('marquee-active');
    requestAnimationFrame(() => {
      if (miniName.scrollWidth > miniName.clientWidth) {
        miniName.classList.add('marquee-active');
      }
    });
  }

  mpEl('music-progress').value = 0;
  mpEl('music-current-time').textContent = '0:00';
  mpEl('music-duration').textContent = '0:00';

  highlightRow(index);
}

// ── Play / Pause ─────────────────────────────────────────────────────────────
window.musicPlayerToggle = function () {
  if (!mp.playlist.length) return;
  if (mp.currentIndex === -1) mpLoad(0);

  if (mp.audio.paused) {
    mp.audio.play();
  } else {
    mp.audio.pause();
  }
};

// ── Prev / Next ───────────────────────────────────────────────────────────────
window.musicPlayerPrev = function () {
  if (!mp.playlist.length) return;
  if (mp.audio.currentTime > 3) { mp.audio.currentTime = 0; return; }
  const prev = getAdjacentIndex(-1);
  mpLoad(prev);
  mp.audio.play();
};

window.musicPlayerNext = function () {
  if (!mp.playlist.length) return;
  const next = getAdjacentIndex(1);
  mpLoad(next);
  mp.audio.play();
};

function getAdjacentIndex(dir) {
  if (mp.shuffle) {
    const pos = mp.shuffleOrder.indexOf(mp.currentIndex);
    const nextPos = (pos + dir + mp.shuffleOrder.length) % mp.shuffleOrder.length;
    return mp.shuffleOrder[nextPos];
  }
  return (mp.currentIndex + dir + mp.playlist.length) % mp.playlist.length;
}

// ── Seek ─────────────────────────────────────────────────────────────────────
window.musicPlayerSeek = function (val) {
  if (isFinite(mp.audio.duration)) {
    mp.audio.currentTime = val;
  }
};

// ── Volume ───────────────────────────────────────────────────────────────────
window.musicPlayerSetVolume = function (val) {
  const numVal = parseInt(val, 10);
  localStorage.setItem('music-player-volume', numVal);
  mp.audio.volume = numVal / 100;

  // Sync all sliders in DOM
  document.querySelectorAll('#music-volume').forEach(el => {
    el.value = numVal;
  });

  // Sync all percentage texts in DOM
  document.querySelectorAll('#music-volume-pct').forEach(el => {
    el.textContent = numVal + '%';
  });

  // Sync all icons in DOM
  document.querySelectorAll('.music-vol-icon').forEach(icon => {
    if (numVal == 0) { icon.className = 'fas fa-volume-xmark music-vol-icon'; }
    else if (numVal < 50) { icon.className = 'fas fa-volume-low music-vol-icon'; }
    else { icon.className = 'fas fa-volume-high music-vol-icon'; }
  });
};

// ── Shuffle ───────────────────────────────────────────────────────────────────
window.musicPlayerToggleShuffle = function () {
  mp.shuffle = !mp.shuffle;
  buildShuffleOrder();
  const btn = mpEl('music-shuffle-btn');
  if (btn) btn.classList.toggle('mp-active', mp.shuffle);
};

// ── Repeat ────────────────────────────────────────────────────────────────────
window.musicPlayerToggleRepeat = function () {
  const modes = ['none', 'all', 'one'];
  const idx = modes.indexOf(mp.repeatMode);
  mp.repeatMode = modes[(idx + 1) % modes.length];

  const btn = mpEl('music-repeat-btn');
  const icon = btn?.querySelector('i');
  if (!btn || !icon) return;

  if (mp.repeatMode === 'none') {
    btn.classList.remove('mp-active');
    icon.className = 'fas fa-repeat';
    btn.title = 'Lặp lại';
  } else if (mp.repeatMode === 'all') {
    btn.classList.add('mp-active');
    icon.className = 'fas fa-repeat';
    btn.title = 'Lặp tất cả';
  } else {
    btn.classList.add('mp-active');
    icon.className = 'fas fa-1';
    btn.title = 'Lặp 1 bài';
  }
};

// ── Render Playlist ───────────────────────────────────────────────────────────
function renderPlaylist() {
  const el = mpEl('music-playlist');
  if (!el) return;

  if (!mp.playlist.length) {
    el.innerHTML = '<div class="music-playlist-empty"><i class="fas fa-music"></i><span>Chọn tệp nhạc để hiện danh sách phát</span></div>';
    return;
  }

  el.innerHTML = mp.playlist.map((t, i) => `
    <div class="mp-row" id="mp-row-${i}" onclick="mpSelectRow(${i})">
      <div class="mp-row-num">${i + 1}</div>
      <div class="mp-row-info">
        <div class="mp-row-name" title="${t.name}">${t.name}</div>
      </div>
      <div class="mp-dur">${t.duration ? mpFmt(t.duration) : '--:--'}</div>
    </div>
  `).join('');
}

window.mpSelectRow = function (index) {
  mpLoad(index);
  mp.audio.play();
};

function highlightRow(index) {
  document.querySelectorAll('.mp-row').forEach((r, i) => {
    r.classList.toggle('mp-row-active', i === index);
  });
}

// ── Audio Events ──────────────────────────────────────────────────────────────
let audioCtx = null;
let analyser = null;
let dataArray = null;
let visualizerActive = false;

function initVisualizer() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaElementSource(mp.audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256; // 128 frequency bins
    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    visualizerActive = true;
    updateVisualizer();
  } catch (e) {
    console.error("Failed to initialize Web Audio Analyser:", e);
  }
}

function updateVisualizer() {
  if (!visualizerActive) return;
  requestAnimationFrame(updateVisualizer);

  const bars = document.querySelectorAll('.vis-bar');
  if (!bars.length) return;

  if (mp.audio.paused) {
    bars.forEach(bar => {
      let h = parseFloat(bar.style.height) || 2;
      if (h > 2) {
        h = Math.max(2, h - 1.2);
        bar.style.height = h + 'px';
      }
    });
    return;
  }

  if (analyser && dataArray) {
    analyser.getByteFrequencyData(dataArray);

    bars.forEach((bar, idx) => {
      // Map 60 bars smoothly to bins 2 to 82 (rich range covering bass to high treble)
      const binIdx = Math.floor(2 + (idx / 60) * 80);
      const val = dataArray[binIdx] || 0;
      
      // Calculate height (from 2px to 18px to fit 20px visualizer box)
      const h = Math.max(2, (val / 255) * 18 + 2);
      bar.style.height = h + 'px';
    });
  }
}
mp.audio.addEventListener('timeupdate', () => {
  const prog = mpEl('music-progress');
  const cur = mpEl('music-current-time');
  if (prog && isFinite(mp.audio.duration)) {
    prog.max = mp.audio.duration;
    prog.value = mp.audio.currentTime;
  }
  if (cur) cur.textContent = mpFmt(mp.audio.currentTime);
});

mp.audio.addEventListener('loadedmetadata', () => {
  const dur = mpEl('music-duration');
  const prog = mpEl('music-progress');
  if (dur) dur.textContent = mpFmt(mp.audio.duration);
  if (prog) { prog.max = mp.audio.duration; prog.value = 0; }

  // Update duration in playlist array & row label
  if (mp.currentIndex >= 0) {
    mp.playlist[mp.currentIndex].duration = mp.audio.duration;
    const row = mpEl(`mp-row-${mp.currentIndex}`);
    if (row) row.querySelector('.mp-dur').textContent = mpFmt(mp.audio.duration);
  }
});

mp.audio.addEventListener('play', () => {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  } else if (!audioCtx) {
    initVisualizer();
  }

  const icon = mpEl('music-play-icon');
  if (icon) { icon.className = 'fas fa-pause'; }
  // Pulse animation on now-playing
  mpEl('music-now-playing')?.classList.add('mp-playing');

  const miniIcon = mpEl('mini-play-icon');
  if (miniIcon) { miniIcon.className = 'fas fa-pause'; }
  mpEl('mini-music-player')?.classList.add('playing');

  if (typeof window.updateMiniPlayerVisibility === 'function') {
    window.updateMiniPlayerVisibility();
  }
});

mp.audio.addEventListener('pause', () => {
  const icon = mpEl('music-play-icon');
  if (icon) { icon.className = 'fas fa-play'; }
  mpEl('music-now-playing')?.classList.remove('mp-playing');

  const miniIcon = mpEl('mini-play-icon');
  if (miniIcon) { miniIcon.className = 'fas fa-play'; }
  mpEl('mini-music-player')?.classList.remove('playing');

  if (typeof window.updateMiniPlayerVisibility === 'function') {
    window.updateMiniPlayerVisibility();
  }
});

mp.audio.addEventListener('ended', () => {
  if (mp.repeatMode === 'one') {
    mp.audio.currentTime = 0;
    mp.audio.play();
  } else if (mp.repeatMode === 'all' || mp.currentIndex < mp.playlist.length - 1) {
    musicPlayerNext();
  } else {
    // stop at end
    mpEl('music-now-playing')?.classList.remove('mp-playing');
    const icon = mpEl('music-play-icon');
    if (icon) icon.className = 'fas fa-play';

    const miniIcon = mpEl('mini-play-icon');
    if (miniIcon) miniIcon.className = 'fas fa-play';
    mpEl('mini-music-player')?.classList.remove('playing');

    if (typeof window.updateMiniPlayerVisibility === 'function') {
      window.updateMiniPlayerVisibility();
    }
  }
});

// ── Keyboard shortcut: Space to play/pause when not in input ─────────────────
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
    e.preventDefault();
    musicPlayerToggle();
  }
});

// ── Initialize volume on load ────────────────────────────────────────────────
(() => {
  const savedVol = localStorage.getItem('music-player-volume') ?? '80';
  const val = parseInt(savedVol, 10);
  mp.audio.volume = val / 100;

  const applyInitialVolume = () => {
    // Generate 60 dense rounded bars dynamically
    const vis = mpEl('music-visualizer');
    if (vis) {
      vis.innerHTML = '';
      for (let i = 0; i < 60; i++) {
        const bar = document.createElement('div');
        bar.className = 'vis-bar';
        vis.appendChild(bar);
      }
    }

    document.querySelectorAll('#music-volume').forEach(el => {
      el.value = val;
    });
    document.querySelectorAll('#music-volume-pct').forEach(el => {
      el.textContent = val + '%';
    });
    document.querySelectorAll('.music-vol-icon').forEach(icon => {
      if (val == 0) { icon.className = 'fas fa-volume-xmark music-vol-icon'; }
      else if (val < 50) { icon.className = 'fas fa-volume-low music-vol-icon'; }
      else { icon.className = 'fas fa-volume-high music-vol-icon'; }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyInitialVolume);
  } else {
    applyInitialVolume();
  }
  window.addEventListener('load', applyInitialVolume);
})();
