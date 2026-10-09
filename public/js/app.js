/* ═══════════════════════════════════════════════════════════
   Kids Romanian Practice — Single Page Application
   ═══════════════════════════════════════════════════════════ */

// ─── State ────────────────────────────────────────────────
const state = {
  user: null,
  currentTier: 'prek', // 'bebe' (1-3) | 'prek' (3-5) | 'junior' (6-8)
  lessons: [],
  currentLesson: null,
  currentPhase: 'vocab', // 'vocab' | 'exercise' | 'explore'
  vocabIndex: 0,
  exerciseIndex: 0, // pointer into exerciseQueue
  exerciseQueue: [],
  retryCounts: {},
  masteredExercises: {},
  answers: [], // attempt history
  score: 0,
  maxAdaptiveRetries: 2,
  autoProgressTimer: null,
  lessonStartTime: null,
  selectedAvatar: '🐑',
  selectedTier: 'prek',
  charts: {},
  stickers: [], // array of unlocked sticker IDs
  bebeTapsCount: 0,
};

// ─── Stickers Album Data (Romanian & Moldovan Collection) ──
const STICKERS_DATA = [
  { id: 'mielul', word: 'Mielul', english: 'Little Lamb', emoji: '🐑', dialect: 'Mascota Noastră' },
  { id: 'harbuz', word: 'Harbuz', english: 'Watermelon (Pepene verde)', emoji: '🍉', dialect: 'Moldovenesc' },
  { id: 'placinta', word: 'Plăcintă', english: 'Traditional Pie', emoji: '🥧', dialect: 'Tradițional' },
  { id: 'papusoi', word: 'Păpușoi', english: 'Corn (Porumb)', emoji: '🌽', dialect: 'Moldovenesc' },
  { id: 'bostan', word: 'Bostan', english: 'Pumpkin (Dovleac)', emoji: '🎃', dialect: 'Moldovenesc' },
  { id: 'barabula', word: 'Barabulă', english: 'Potato (Cartof)', emoji: '🥔', dialect: 'Moldovenesc' },
  { id: 'hutusca', word: 'Huțușcă', english: 'Swing (Leagăn)', emoji: '🛝', dialect: 'Moldovenesc' },
  { id: 'omat', word: 'Omăt', english: 'Snow (Zăpadă)', emoji: '❄️', dialect: 'Moldovenesc' },
  { id: 'perje', word: 'Perje', english: 'Plums (Prune)', emoji: '🍇', dialect: 'Moldovenesc' },
  { id: 'pisicuta', word: 'Pisicuța', english: 'Kitten', emoji: '🐱', dialect: 'Animale' },
  { id: 'catelus', word: 'Cățelușul', english: 'Puppy', emoji: '🐶', dialect: 'Animale' },
  { id: 'ursulet', word: 'Ursulețul', english: 'Bear', emoji: '🐻', dialect: 'Animale' },
  { id: 'soare', word: 'Soare', english: 'Sun', emoji: '☀️', dialect: 'Natură' },
  { id: 'mar', word: 'Măr', english: 'Apple', emoji: '🍎', dialect: 'Fructe' },
  { id: 'paine', word: 'Pâine', english: 'Bread', emoji: '🍞', dialect: 'Mâncare' },
  { id: 'curcubeu', word: 'Curcubeu', english: 'Rainbow', emoji: '🌈', dialect: 'Natură' },
];

const KID_AVATARS = [
  { name: 'Mielul', emoji: '🐑' },
  { name: 'Andrei', emoji: '🧒' },
  { name: 'Elena', emoji: '👧' },
  { name: 'Bebe', emoji: '👶' },
  { name: 'Vulpița', emoji: '🦊' },
  { name: 'Pisicuța', emoji: '🐱' },
  { name: 'Cățelușul', emoji: '🐶' },
  { name: 'Leuțul', emoji: '🦁' },
  { name: 'Pandi', emoji: '🐼' },
  { name: 'Uni', emoji: '🦄' }
];

const AVATARS = ['🐑', '🧒', '👦', '👧', '👶', '🦸', '🧙', '🦊', '🐱', '🐶', '🦁', '🐼', '🦄', '🐸', '🐵'];
let cachedRomanianVoice = null;
const GUEST_USER = { id: null, username: 'guest', displayName: 'Mielul', role: 'guest', avatar: '🐑' };

// ─── API Helper ───────────────────────────────────────────
async function api(method, url, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── Sound Effects (Web Audio API Synthesizer) ────────────
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(type) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'correct') {
      // Pleasant bright ascending chime: C5 -> E5 -> G5
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.2, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.22);
      });
    } else if (type === 'incorrect') {
      // Gentle soft two-tone boop
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.2);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    } else if (type === 'match') {
      // Quick cheerful bubble pop
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'fanfare') {
      // Celebratory arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.11);
        gain.gain.setValueAtTime(0.25, now + idx * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.11);
        osc.stop(now + idx * 0.11 + 0.35);
      });
    }
  } catch (e) {
    // AudioContext blocked or unsupported
  }
}

// ─── Speech Helper (With Turtle Slow Replay 🐢) ───────────
let currentAudio = null;

function pickRomanianVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;
  return voices.find(v => /^ro(-|_)/i.test(v.lang)) || null;
}

function sanitizeAudioFilename(text) {
  if (!text) return '';
  return text.toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 50);
}

function speakTTS(text, { rate = 0.85, pitch = 1 } = {}) {
  if (!text || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    return false;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ro-RO';
  utterance.rate = rate;
  utterance.pitch = pitch;
  cachedRomanianVoice = cachedRomanianVoice || pickRomanianVoice();
  if (cachedRomanianVoice) utterance.voice = cachedRomanianVoice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

function speakRomanian(text, opts = {}) {
  const rate = typeof opts.rate === 'number' ? opts.rate : 0.85;
  const pitch = typeof opts.pitch === 'number' ? opts.pitch : 1.0;

  // Stop any currently playing audio
  if (currentAudio) {
    try { currentAudio.pause(); } catch {}
    currentAudio = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  if (!text) return false;

  const tryPlayUrl = (url, onFail) => {
    const audio = new Audio(url);
    try { audio.playbackRate = rate; } catch {}
    let handled = false;
    const handleError = () => {
      if (handled) return;
      handled = true;
      if (onFail) onFail();
    };

    audio.onerror = handleError;
    audio.onplay = () => {
      currentAudio = audio;
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(handleError);
    }
    return true;
  };

  const playServerTTSFallback = () => {
    const ttsUrl = `/api/tts?text=${encodeURIComponent(text)}`;
    tryPlayUrl(ttsUrl, () => {
      speakTTS(text, { rate, pitch });
    });
  };

  // Try lesson-specific audio file first if inside a lesson
  if (state.currentLesson && state.currentLesson.id) {
    const filename = sanitizeAudioFilename(text) + '.mp3';
    const lessonUrl = `/audio/${state.currentLesson.id}/${filename}`;
    return tryPlayUrl(lessonUrl, playServerTTSFallback);
  }

  // Outside lesson or custom sentence
  return playServerTTSFallback();
}

function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedRomanianVoice = pickRomanianVoice();
  };
}

function isGuestUser() {
  return !state.user || state.user.role === 'guest';
}

function canPersistProgress() {
  return !!(state.user && state.user.id && !isGuestUser());
}

function clearAutoProgressTimer() {
  if (state.autoProgressTimer) {
    clearTimeout(state.autoProgressTimer);
    state.autoProgressTimer = null;
  }
}

// ─── Age Tier Switching & Styling ─────────────────────────
function setTier(tier) {
  const safeTier = ['bebe', 'prek', 'junior'].includes(tier) ? tier : 'prek';
  state.currentTier = safeTier;
  document.body.dataset.tier = safeTier;

  // Persist for guest or logged in student
  if (isGuestUser()) {
    try {
      const guest = JSON.parse(localStorage.getItem('romanianKidsGuestProfile') || '{}');
      guest.tier = safeTier;
      localStorage.setItem('romanianKidsGuestProfile', JSON.stringify(guest));
    } catch {}
  } else if (state.user && state.user.id) {
    api('POST', '/api/student/profile', { tier: safeTier }).catch(() => {});
  }
}

// ─── Sticker Album Helpers ────────────────────────────────
function getGuestStickers() {
  try {
    const raw = localStorage.getItem('romanianKidsGuestStickers');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return ['mielul']; // Little Lamb unlocked by default!
}

function saveGuestStickers(stickers) {
  try {
    localStorage.setItem('romanianKidsGuestStickers', JSON.stringify(stickers));
  } catch {}
}

async function loadUnlockedStickers() {
  if (isGuestUser() || !state.user || !state.user.id) {
    state.stickers = getGuestStickers();
    return state.stickers;
  }
  try {
    const data = await api('GET', '/api/stickers');
    const ids = (data.stickers || []).map(s => s.stickerId);
    if (!ids.includes('mielul')) ids.unshift('mielul');
    state.stickers = ids;
    saveGuestStickers(ids);
  } catch {
    state.stickers = getGuestStickers();
  }
  return state.stickers;
}

async function unlockStickerReward(lessonId = null) {
  const current = state.stickers && state.stickers.length > 0 ? [...state.stickers] : ['mielul'];
  const locked = STICKERS_DATA.filter(s => !current.includes(s.id));
  if (locked.length === 0) return null;
  const picked = locked[Math.floor(Math.random() * locked.length)];

  current.push(picked.id);
  state.stickers = current;
  saveGuestStickers(current);

  if (!isGuestUser() && state.user && state.user.id) {
    try {
      await api('POST', '/api/stickers/unlock', {
        stickerId: picked.id,
        lessonId: lessonId || (state.currentLesson ? state.currentLesson.id : null),
        tier: state.currentTier
      });
    } catch {}
  }
  return picked;
}

function openStickerAlbumModal() {
  const existing = document.getElementById('sticker-modal-overlay');
  if (existing) existing.remove();

  const unlockedIds = state.stickers || ['mielul'];
  const totalStickers = STICKERS_DATA.length;
  const count = unlockedIds.length;

  const overlay = document.createElement('div');
  overlay.id = 'sticker-modal-overlay';
  overlay.className = 'sticker-modal-overlay';

  overlay.innerHTML = `
    <div class="sticker-modal" id="sticker-modal-content">
      <button class="sticker-modal-close" id="sticker-modal-close" type="button" title="Închide">✕</button>
      <div class="sticker-modal-header">
        <h2 class="sticker-modal-title">🌟 Albumul Meu de Abțibilduri 🇲🇩 🇷🇴</h2>
        <p class="sticker-modal-subtitle">Apasă pe un abțibild deblocat pentru a auzi cuvântul!</p>
        <div class="sticker-progress-pill">${count} din ${totalStickers} abțibilduri deblocate</div>
      </div>
      <div class="sticker-album-grid">
        ${STICKERS_DATA.map(st => {
          const isUnlocked = unlockedIds.includes(st.id);
          return `
            <div class="sticker-badge ${isUnlocked ? 'unlocked' : 'locked'}" data-sticker-id="${st.id}" data-sticker-word="${escapeHTML(st.word)}">
              ${!isUnlocked ? '<span class="sticker-lock-icon">🔒</span>' : ''}
              <div class="sticker-emoji">${st.emoji}</div>
              <div class="sticker-badge-name">${isUnlocked ? escapeHTML(st.word) : '???'}</div>
              <div class="sticker-badge-tag">${escapeHTML(st.dialect)}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('sticker-modal-close')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelectorAll('.sticker-badge.unlocked').forEach(badge => {
    badge.addEventListener('click', () => {
      const word = badge.dataset.stickerWord;
      badge.style.transform = 'scale(1.25) rotate(6deg)';
      playSound('match');
      if (word) speakRomanian(word);
      setTimeout(() => {
        badge.style.transform = '';
      }, 400);
    });
  });
}

// ─── Mascot Mielul Cheering & Greetings ───────────────────
const MASCOT_QUOTES = [
  'Bună! Eu sunt Mielul 🐑! Hai să învățăm românește!',
  'Mbeee! Ce frumos e să învățăm împreună! 🐑✨',
  'Ești grozav! Apasă pe o lecție și începem! 🐑🎉',
  'Graiul moldovenesc și limba română sunt o bucurie! 🐑🇲🇩',
];

function clickMascot() {
  const quote = MASCOT_QUOTES[Math.floor(Math.random() * MASCOT_QUOTES.length)];
  showToast(quote, 'success');
  playSound('match');
  speakRomanian(quote.replace(/[🐑✨🎉🇲🇩]/g, '').trim());
}

function showMascotBubble(text) {
  const el = document.getElementById('mascot-reaction-bubble');
  if (el) {
    el.innerHTML = `
      <span class="mascot-lamb">🐑</span>
      <span class="mascot-bubble-text">${escapeHTML(text)}</span>
    `;
    el.style.display = 'inline-flex';
  }
}

// ─── Router ───────────────────────────────────────────────
function navigate(hash) {
  if (window.location.hash === '#' + hash) {
    // Hash is already at the target — force a re-render
    router();
  } else {
    window.location.hash = hash;
  }
}

function getRoute() {
  return window.location.hash.slice(1) || '/';
}

window.addEventListener('hashchange', () => router());

async function router() {
  const route = getRoute();
  const app = document.getElementById('app');

  // Not logged in — show avatar welcome / auth page
  if (!state.user) {
    if (route === '/register') {
      renderRegister(app);
    } else {
      renderLogin(app);
    }
    return;
  }

  // Logged in
  if (route.startsWith('/lesson/')) {
    const lessonId = route.split('/lesson/')[1];
    await startLesson(app, lessonId);
  } else if (route === '/parent') {
    await renderParentDashboard(app);
  } else {
    await renderDashboard(app);
  }
}

// ─── Init ─────────────────────────────────────────────────
async function init() {
  try {
    const data = await api('GET', '/api/auth/me');
    state.user = data.user;
    if (state.user) {
      try {
        const profData = await api('GET', '/api/student/profile');
        if (profData?.profile?.tier) {
          state.currentTier = profData.profile.tier;
        }
      } catch {}
    }
  } catch {
    // Check localStorage guest profile
    try {
      const saved = localStorage.getItem('romanianKidsGuestProfile');
      if (saved) {
        const p = JSON.parse(saved);
        if (p && p.displayName) {
          state.user = {
            id: null,
            username: 'guest_' + p.displayName.toLowerCase(),
            displayName: p.displayName,
            role: 'guest',
            avatar: p.avatar || '🐑'
          };
          state.currentTier = p.tier || 'prek';
        }
      }
    } catch {}
  }

  document.body.dataset.tier = state.currentTier || 'prek';
  await loadUnlockedStickers();
  router();
}

document.addEventListener('DOMContentLoaded', init);

// ═══════════════════════════════════════════════════════════
//  AUTH VIEWS
// ═══════════════════════════════════════════════════════════

function renderLogin(container) {
  let selectedTier = state.selectedTier || 'prek';

  container.innerHTML = `
    <div class="welcome-screen">
      <div class="welcome-card">
        <div class="welcome-header">
          <div class="welcome-mascot-hero" id="welcome-mascot" title="Apasă pe Mielul!">🐑</div>
          <h1 class="welcome-title">Cine se joacă astăzi?</h1>
          <p class="welcome-subtitle">Alege grupa de vârstă și personajul tău preferat!</p>
        </div>

        <div class="welcome-tier-section">
          <div class="welcome-section-label">1. Vârsta ta</div>
          <div class="welcome-tier-grid" id="welcome-tier-grid">
            <div class="welcome-tier-card ${selectedTier === 'bebe' ? 'selected' : ''}" data-tier="bebe">
              <div class="welcome-tier-icon">🍼</div>
              <div class="welcome-tier-name">Bebe</div>
              <div class="welcome-tier-age">1–3 ani</div>
              <div class="welcome-tier-desc">Explorează & Ascultă</div>
            </div>
            <div class="welcome-tier-card ${selectedTier === 'prek' ? 'selected' : ''}" data-tier="prek">
              <div class="welcome-tier-icon">🌱</div>
              <div class="welcome-tier-name">Pre-K</div>
              <div class="welcome-tier-age">3–5 ani</div>
              <div class="welcome-tier-desc">Ascultă & Alege</div>
            </div>
            <div class="welcome-tier-card ${selectedTier === 'junior' ? 'selected' : ''}" data-tier="junior">
              <div class="welcome-tier-icon">⭐</div>
              <div class="welcome-tier-name">Junior</div>
              <div class="welcome-tier-age">6–8 ani</div>
              <div class="welcome-tier-desc">Cuvinte & Jocuri</div>
            </div>
          </div>
        </div>

        <div class="welcome-avatar-section">
          <div class="welcome-section-label">2. Alege personajul tău</div>
          <div class="avatar-tile-grid" id="avatar-tile-grid">
            ${KID_AVATARS.map(a => `
              <div class="avatar-tile" data-avatar="${a.emoji}" data-name="${escapeHTML(a.name)}">
                <div class="avatar-tile-emoji">${a.emoji}</div>
                <div class="avatar-tile-name">${escapeHTML(a.name)}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="parent-toggle-row">
          <button class="parent-toggle-btn" id="toggle-parent-login" type="button">🔐 Părinți / Login cu cont</button>
        </div>

        <!-- Hidden Parent Login Box -->
        <div id="parent-login-box" style="display:none; margin-top:1.5rem; text-align:left; border-top:1px solid #e2e8f0; padding-top:1.5rem;">
          <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:0.75rem; color:#2d3748">🔐 Conectare Părinte / Admin</h3>
          <div id="auth-error" class="auth-error"></div>
          <form id="login-form">
            <div class="form-group">
              <label class="form-label" for="login-user">Utilizator</label>
              <input class="form-input" type="text" id="login-user" placeholder="username" autocomplete="username" autocapitalize="off" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="login-pass">Parolă</label>
              <input class="form-input" type="password" id="login-pass" placeholder="password" autocomplete="current-password" required>
            </div>
            <button type="submit" class="btn btn-primary btn-block" id="login-btn">🔑 Intră în cont</button>
          </form>
          <p class="auth-switch" style="margin-top:1rem">Nu ai cont? <a id="go-register">Creează unul</a></p>
        </div>
      </div>
    </div>
  `;

  // Mascot tap
  document.getElementById('welcome-mascot')?.addEventListener('click', () => {
    clickMascot();
  });

  // Tier picker click
  document.querySelectorAll('.welcome-tier-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.welcome-tier-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedTier = card.dataset.tier;
      state.selectedTier = selectedTier;
      setTier(selectedTier);
      playSound('match');
    });
  });

  // Kid Avatar click -> instant guest login!
  document.querySelectorAll('.avatar-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const name = tile.dataset.name;
      const emoji = tile.dataset.avatar;

      state.user = {
        id: null,
        username: 'guest_' + name.toLowerCase(),
        displayName: name,
        role: 'guest',
        avatar: emoji
      };
      setTier(selectedTier);

      // Save to localStorage
      try {
        localStorage.setItem('romanianKidsGuestProfile', JSON.stringify({
          displayName: name,
          avatar: emoji,
          tier: selectedTier
        }));
      } catch {}

      playSound('fanfare');
      speakRomanian(`Bună, ${name}!`);
      navigate('/');
    });
  });

  // Parent login toggle
  const toggleBtn = document.getElementById('toggle-parent-login');
  const parentBox = document.getElementById('parent-login-box');
  toggleBtn?.addEventListener('click', () => {
    if (parentBox.style.display === 'none') {
      parentBox.style.display = 'block';
      toggleBtn.textContent = '▲ Ascunde formularul de login';
      parentBox.scrollIntoView({ behavior: 'smooth' });
    } else {
      parentBox.style.display = 'none';
      toggleBtn.textContent = '🔐 Părinți / Login cu cont';
    }
  });

  document.getElementById('go-register')?.addEventListener('click', () => navigate('/register'));

  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('auth-error');
    errEl.classList.remove('visible');
    try {
      const data = await api('POST', '/api/auth/login', {
        username: document.getElementById('login-user').value.trim(),
        password: document.getElementById('login-pass').value,
      });
      state.user = data.user;
      if (data.user) {
        try {
          const profData = await api('GET', '/api/student/profile');
          if (profData?.profile?.tier) {
            setTier(profData.profile.tier);
          }
        } catch {}
      }
      navigate('/');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('visible');
    }
  });
}

function renderRegister(container) {
  container.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-flag">🇷🇴</div>
        <h1 class="auth-title">Create Account</h1>
        <p class="auth-subtitle">Pick an avatar and join the fun!</p>
        <div id="auth-error" class="auth-error"></div>
        <form id="register-form">
          <div class="form-group">
            <label class="form-label">Choose your avatar</label>
            <div class="avatar-picker" id="avatar-picker">
              ${AVATARS.map(a => `<div class="avatar-option${a === '🧒' ? ' selected' : ''}" data-avatar="${a}">${a}</div>`).join('')}
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-display">Your Name</label>
            <input class="form-input" type="text" id="reg-display" placeholder="e.g. Maria" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-user">Username</label>
            <input class="form-input" type="text" id="reg-user" placeholder="e.g. maria123" autocapitalize="off" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="reg-pass">Password</label>
            <input class="form-input" type="password" id="reg-pass" placeholder="Create a password" required>
          </div>
          <button type="submit" class="btn btn-primary btn-lg btn-block" id="reg-btn">🎉 Create Account</button>
        </form>
        <p class="auth-switch">Already have an account? <a id="go-login">Sign in</a></p>
      </div>
    </div>
  `;

  state.selectedAvatar = '🧒';
  document.getElementById('go-login').addEventListener('click', () => navigate('/'));

  // Avatar picker
  document.getElementById('avatar-picker').addEventListener('click', (e) => {
    const opt = e.target.closest('.avatar-option');
    if (!opt) return;
    document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    state.selectedAvatar = opt.dataset.avatar;
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('auth-error');
    errEl.classList.remove('visible');
    try {
      await api('POST', '/api/auth/register', {
        displayName: document.getElementById('reg-display').value.trim(),
        username: document.getElementById('reg-user').value.trim(),
        password: document.getElementById('reg-pass').value,
        avatar: state.selectedAvatar,
        role: 'student',
      });
      // Auto-login
      const data = await api('POST', '/api/auth/login', {
        username: document.getElementById('reg-user').value.trim(),
        password: document.getElementById('reg-pass').value,
      });
      state.user = data.user;
      navigate('/');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('visible');
    }
  });
}

// ═══════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════

async function renderDashboard(container) {
  try {
    const lessonData = await api('GET', '/api/lessons');
    state.lessons = lessonData.lessons || [];

    let stats = {
      completedLessons: 0,
      totalLessons: state.lessons.length,
      averageScore: 0,
      totalTimeSec: 0,
      recentResults: [],
      bestScores: []
    };
    const bestScoresMap = {};

    if (!isGuestUser()) {
      const statsData = await api('GET', `/api/progress/stats/${state.user.id}`);
      stats = { ...stats, ...statsData };
      (stats.bestScores || []).forEach(b => { bestScoresMap[b.lessonId] = b; });
    }

    const totalMinutes = Math.round((stats.totalTimeSec || 0) / 60);
    const guestNotice = isGuestUser()
      ? `<div class="card mb-2" style="background:#fffbeb; border:2px solid #fde68a; border-radius:18px; padding:0.85rem 1.25rem;">
          <span style="font-size:1.2rem">🐑</span> <strong>Mod Explorator (Guest):</strong> Te joci fără parolă! Progresul și abțibildurile se salvează pe acest dispozitiv.
        </div>`
      : '';

    // Mascot greeting quote based on tier
    let mascotGreeting = '';
    if (state.currentTier === 'bebe') {
      mascotGreeting = `Bună, ${state.user.displayName}! Eu sunt Mielul 🐑. Alege o lume de mai jos și apasă pe imagini!`;
    } else if (state.currentTier === 'prek') {
      mascotGreeting = `Bună, ${state.user.displayName}! Ascultă cuvintele și găsește pozele potrivite! 🐑🌱`;
    } else {
      mascotGreeting = `Bună, ${state.user.displayName}! Construiește propoziții, potrivește cuvinte și adună steluțe! 🐑⭐`;
    }

    // Filter lessons matching the current tier
    const tierFilteredLessons = state.lessons.filter(l => {
      if (!l.tiers || !Array.isArray(l.tiers)) return true;
      return l.tiers.includes(state.currentTier);
    });

    const BEBE_WORLDS = [
      { id: 'animals-04', title: 'Animale', icon: '🐾', desc: 'Pisică, Câine, Cal, Vacă...' },
      { id: 'food-06', title: 'Mâncare', icon: '🍎', desc: 'Măr, Pâine, Lapte, Apă...' },
      { id: 'family-05', title: 'Familia', icon: '👨‍👩‍👧', desc: 'Mama, Tata, Bunica, Bunicul...' },
      { id: 'pre-k-toys-14', title: 'Jucării', icon: '🧸', desc: 'Minge, Ursuleț, Trenuleț...' },
      { id: 'pre-k-vehicles-22', title: 'Vehicule', icon: '🚗', desc: 'Mașină, Autobuz, Avion...' },
      { id: 'moldovan-words-23', title: 'Graiul Nostru', icon: '🇲🇩', desc: 'Harbuz, Zămos, Plăcintă...' },
      { id: 'colors-02', title: 'Culori', icon: '🌈', desc: 'Roșu, Albastru, Galben, Verde...' },
      { id: 'pre-k-body-13', title: 'Corpul Meu', icon: '👃', desc: 'Nas, Ochi, Gură, Mână...' }
    ];

    container.innerHTML = `
      ${renderNavbar()}
      <div class="dashboard">
        <!-- Mascot speech bubble banner -->
        <div class="mascot-bubble" id="mascot-reaction-bubble" style="cursor:pointer;" title="Apasă pe Mielul!">
          <span class="mascot-lamb">🐑</span>
          <span class="mascot-bubble-text">${escapeHTML(mascotGreeting)}</span>
        </div>

        ${guestNotice}

        ${(!isGuestUser() && state.currentTier === 'junior') ? `
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-icon">📚</div>
            <div class="stat-value">${stats.completedLessons}/${stats.totalLessons}</div>
            <div class="stat-label">Lecții terminate</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⭐</div>
            <div class="stat-value">${stats.averageScore}%</div>
            <div class="stat-label">Scor mediu</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⏱️</div>
            <div class="stat-value">${totalMinutes}m</div>
            <div class="stat-label">Timp învățare</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🌟</div>
            <div class="stat-value">${(state.stickers || []).length}/${STICKERS_DATA.length}</div>
            <div class="stat-label">Abțibilduri</div>
          </div>
        </div>
        ` : ''}

        ${state.currentTier === 'bebe' ? `
          <!-- 🍼 BEBE WORLDS EXPLORE VIEW -->
          <div class="section-header" style="text-align:center; margin-bottom:1.5rem">
            <h2 class="section-title" style="font-size:2rem">🍼 Lumile lui Bebe</h2>
            <p style="color:var(--text-secondary); font-size:1.1rem; font-weight:700">Apasă pe orice lume pentru a explora fără greșeli!</p>
          </div>

          <div class="bebe-worlds-grid">
            ${BEBE_WORLDS.map(w => `
              <div class="bebe-world-card" data-lesson="${w.id}">
                <div class="bebe-world-icon">${w.icon}</div>
                <div class="bebe-world-title">${w.title}</div>
                <div class="bebe-world-desc">${w.desc}</div>
              </div>
            `).join('')}
          </div>
        ` : `
          <!-- 🌱 PRE-K AND ⭐ JUNIOR LESSONS VIEW -->
          <div class="section-header">
            <h2 class="section-title">
              ${state.currentTier === 'prek' ? '🌱 Lecții Pre-K (Ascultă & Alege)' : '⭐ Lecții Junior (Cuvinte & Imagini)'}
            </h2>
          </div>
          <div class="category-filters" id="category-filters">
            <button class="category-pill active" data-category="all">Toate (${tierFilteredLessons.length})</button>
            <button class="category-pill" data-category="Graiul Moldovenesc">🇲🇩 Graiul Moldovenesc</button>
            <button class="category-pill" data-category="Pre-K">👶 Pre-K Audio</button>
            <button class="category-pill" data-category="Basics">🌟 Basics</button>
            <button class="category-pill" data-category="Daily Life">🍎 Daily Life</button>
          </div>

          <div class="lessons-grid">
            ${tierFilteredLessons.map(l => {
              const best = bestScoresMap[l.id];
              const pct = best ? best.bestScore : 0;
              const isCompleted = pct >= 80;
              const isMoldovan = l.category === 'Graiul Moldovenesc';

              // Calculate star rating for Junior
              let starIcons = '';
              if (state.currentTier === 'junior') {
                if (pct >= 95) starIcons = '⭐⭐⭐';
                else if (pct >= 80) starIcons = '⭐⭐';
                else if (pct >= 60) starIcons = '⭐';
              }

              return `
                <div class="lesson-card${isCompleted ? ' completed' : ''}" data-lesson="${l.id}" data-category="${escapeHTML(l.category)}" id="lesson-${l.id}">
                  <div class="lesson-card-icon">${l.icon || '📚'}</div>
                  <div class="lesson-card-title">${escapeHTML(l.title)}</div>
                  <div class="lesson-card-desc">${escapeHTML(l.description)}</div>
                  <div class="lesson-card-meta">
                    <span class="lesson-card-badge badge-category${isMoldovan ? ' badge-moldova' : ''}">${escapeHTML(l.category)}</span>
                    ${starIcons ? `<span class="lesson-card-badge" style="background:#fef3c7; color:#b45309; font-weight:800;">${starIcons}</span>` : `<span class="lesson-card-badge badge-level">Level ${l.level}</span>`}
                    <span>${l.vocabularyCount} cuvinte · ${l.exerciseCount} exerciții</span>
                  </div>
                  ${pct > 0 && !isCompleted ? `
                    <div class="lesson-progress-ring">
                      <svg width="40" height="40" viewBox="0 0 40 40">
                        <circle class="ring-bg" cx="20" cy="20" r="16"/>
                        <circle class="ring-fill" cx="20" cy="20" r="16"
                          stroke-dasharray="${2 * Math.PI * 16}"
                          stroke-dashoffset="${2 * Math.PI * 16 * (1 - pct / 100)}"/>
                      </svg>
                      <span class="lesson-progress-text">${pct}%</span>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        `}

        <!-- Sticker shelf banner preview -->
        <div class="card mt-3" style="background:linear-gradient(135deg, #fff9db 0%, #fff0f6 100%); border:3px solid #ffc078; border-radius:24px; padding:1.5rem; text-align:center;">
          <h3 style="font-size:1.35rem; font-weight:900; color:#d9480f; margin-bottom:0.35rem;">
            🌟 Albumul Tău de Abțibilduri: ${(state.stickers || []).length} din ${STICKERS_DATA.length} deblocate!
          </h3>
          <p style="color:#7a5c00; font-weight:700; margin-bottom:1rem;">
            Finalizează lecții pentru a primi abțibilduri cu Mielul 🐑, Harbuz 🍉, Plăcintă 🥧, Păpușoi 🌽 și multe altele!
          </p>
          <button class="btn btn-primary" id="open-stickers-shelf" type="button" style="background:#f76707; border-color:#d9480f;">
            📖 Deschide Albumul de Abțibilduri
          </button>
        </div>
      </div>
    `;

    // Interactive speech bubble
    document.getElementById('mascot-reaction-bubble')?.addEventListener('click', () => {
      clickMascot();
    });

    document.getElementById('open-stickers-shelf')?.addEventListener('click', () => {
      openStickerAlbumModal();
    });

    // Category pills filter
    document.querySelectorAll('.category-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const cat = pill.dataset.category;
        document.querySelectorAll('.lesson-card').forEach(card => {
          const cardCat = card.dataset.category || '';
          if (cat === 'all') {
            card.style.display = '';
          } else if (cat === 'Pre-K') {
            card.style.display = cardCat.toLowerCase().includes('pre-k') ? '' : 'none';
          } else {
            card.style.display = cardCat.toLowerCase().includes(cat.toLowerCase()) ? '' : 'none';
          }
        });
      });
    });

    // Lesson card & Bebe world card clicks
    document.querySelectorAll('.lesson-card, .bebe-world-card').forEach(card => {
      card.addEventListener('click', () => {
        navigate(`/lesson/${card.dataset.lesson}`);
      });
    });

    setupNavbar();
  } catch (err) {
    container.innerHTML = `<div class="flex-center" style="min-height:100vh"><p>Error loading: ${err.message}</p></div>`;
  }
}

// ═══════════════════════════════════════════════════════════
//  NAVBAR
// ═══════════════════════════════════════════════════════════

function renderNavbar() {
  const hasDashboard = state.user && ['parent', 'admin'].includes(state.user.role);
  const stickerCount = (state.stickers || []).length;
  const authButton = isGuestUser()
    ? '<button class="btn btn-ghost" id="nav-signin" title="Schimbă personajul sau intră în cont">🔄 Schimbă</button>'
    : '<button class="btn btn-ghost" id="nav-logout" title="Ieșire din cont">🚪</button>';

  return `
    <nav class="navbar">
      <a class="navbar-brand" id="nav-home">
        <span class="flag">🇷🇴 🇲🇩</span>
        <span>Învață Română</span>
      </a>

      <!-- Tier switcher pill -->
      <div class="navbar-tier-switcher">
        <button class="tier-switch-btn ${state.currentTier === 'bebe' ? 'active' : ''}" data-tier-btn="bebe" title="Bebe (1–3 ani)">
          🍼 <span>Bebe</span>
        </button>
        <button class="tier-switch-btn ${state.currentTier === 'prek' ? 'active' : ''}" data-tier-btn="prek" title="Pre-K (3–5 ani)">
          🌱 <span>Pre-K</span>
        </button>
        <button class="tier-switch-btn ${state.currentTier === 'junior' ? 'active' : ''}" data-tier-btn="junior" title="Junior (6–8 ani)">
          ⭐ <span>Junior</span>
        </button>
      </div>

      <div class="navbar-user">
        <!-- Friendly mascot button -->
        <button class="navbar-mascot" id="nav-mascot" type="button" title="Mielul 🐑 — Apasă pentru o vorbă bună!">
          <span class="mascot-icon">🐑</span>
          <span class="mascot-badge-text">Mielul</span>
        </button>

        <!-- Sticker Album modal trigger -->
        <button class="navbar-stickers-btn" id="nav-stickers" type="button" title="Vezi albumul de abțibilduri">
          🌟 <span class="stickers-count">${stickerCount}/${STICKERS_DATA.length}</span>
        </button>

        ${hasDashboard ? '<button class="btn btn-ghost" id="nav-parent">📊 Părinți</button>' : ''}
        <div class="navbar-avatar" title="${state.user ? state.user.displayName : 'Guest'}">${state.user ? (state.user.avatar || '🐑') : '🐑'}</div>
        <span class="navbar-name">${state.user ? state.user.displayName : 'Explorator'}</span>
        ${authButton}
      </div>
    </nav>
  `;
}

function setupNavbar() {
  document.getElementById('nav-home')?.addEventListener('click', () => navigate('/'));

  // Tier Switcher Buttons
  document.querySelectorAll('[data-tier-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTier = btn.dataset.tierBtn;
      setTier(targetTier);
      playSound('match');
      showToast(`Grupa schimbată: ${targetTier === 'bebe' ? '🍼 Bebe (1–3 ani)' : targetTier === 'prek' ? '🌱 Pre-K (3–5 ani)' : '⭐ Junior (6–8 ani)'}`);
      const app = document.getElementById('app');
      if (getRoute().startsWith('/lesson/')) {
        renderLesson(app);
      } else {
        renderDashboard(app);
      }
    });
  });

  // Mascot button click
  document.getElementById('nav-mascot')?.addEventListener('click', () => {
    clickMascot();
  });

  // Sticker Album modal click
  document.getElementById('nav-stickers')?.addEventListener('click', () => {
    openStickerAlbumModal();
  });

  document.getElementById('nav-logout')?.addEventListener('click', async () => {
    clearAutoProgressTimer();
    try {
      await api('POST', '/api/auth/logout');
    } catch { }
    state.user = null;
    navigate('/');
  });

  document.getElementById('nav-signin')?.addEventListener('click', () => {
    clearAutoProgressTimer();
    state.user = null;
    try { localStorage.removeItem('romanianKidsGuestProfile'); } catch {}
    navigate('/');
  });

  document.getElementById('nav-parent')?.addEventListener('click', () => navigate('/parent'));
}

// ═══════════════════════════════════════════════════════════
//  LESSON PLAYER
// ═══════════════════════════════════════════════════════════

async function startLesson(container, lessonId) {
  try {
    if (!state.lessons || state.lessons.length === 0) {
      const { lessons } = await api('GET', '/api/lessons');
      state.lessons = lessons || [];
    }

    const { lesson } = await api('GET', `/api/lessons/${lessonId}`);
    state.currentLesson = lesson;
    state.currentPhase = 'vocab';
    state.vocabIndex = 0;
    state.exerciseIndex = 0;
    state.exerciseQueue = Array.from({ length: (lesson.exercises || []).length }, (_, i) => i);
    state.retryCounts = {};
    state.masteredExercises = {};
    state.answers = [];
    state.score = 0;
    state.lessonStartTime = Date.now();
    clearAutoProgressTimer();

    // Check for saved progress
    if (canPersistProgress()) {
      try {
        const { progress } = await api('GET', `/api/progress/lesson/${lessonId}`);
        if (progress && Number.isInteger(progress.currentExercise) && progress.currentExercise >= 0) {
          state.currentPhase = 'exercise';
          state.exerciseIndex = progress.currentExercise;
          if (Array.isArray(progress.answers)) {
            state.answers = progress.answers;
            state.masteredExercises = {};
            const exerciseCount = (lesson.exercises || []).length;
            state.answers.forEach((ok, idx) => {
              if (ok === true && idx < exerciseCount) state.masteredExercises[String(idx)] = true;
            });
            state.score = Object.values(state.masteredExercises).filter(Boolean).length;
          } else if (progress.answers && typeof progress.answers === 'object') {
            const payload = progress.answers;
            state.answers = Array.isArray(payload.answerHistory) ? payload.answerHistory : [];
            if (Array.isArray(payload.exerciseQueue) && payload.exerciseQueue.length > 0) {
              const maxIdx = (lesson.exercises || []).length - 1;
              state.exerciseQueue = payload.exerciseQueue
                .map(Number)
                .filter(v => Number.isInteger(v) && v >= 0 && v <= maxIdx);
              if (state.exerciseQueue.length === 0) {
                state.exerciseQueue = Array.from({ length: (lesson.exercises || []).length }, (_, i) => i);
              }
            }
            state.retryCounts = payload.retryCounts && typeof payload.retryCounts === 'object' ? payload.retryCounts : {};
            state.masteredExercises = payload.masteredExercises && typeof payload.masteredExercises === 'object'
              ? payload.masteredExercises
              : {};
            state.score = Number.isFinite(payload.score)
              ? payload.score
              : Object.values(state.masteredExercises).filter(Boolean).length;
          }
          if (state.exerciseIndex >= state.exerciseQueue.length) {
            state.exerciseIndex = Math.max(0, state.exerciseQueue.length - 1);
          }
        }
      } catch { }
    }

    if (state.currentPhase === 'exercise' && state.exerciseQueue.length === 0) {
      const totalExercises = (lesson.exercises || []).length;
      state.exerciseQueue = Array.from({ length: totalExercises }, (_, i) => i);
      if (state.exerciseIndex >= state.exerciseQueue.length) {
        state.exerciseIndex = Math.max(0, state.exerciseQueue.length - 1);
      }
    }

    renderLesson(container);
  } catch (err) {
    container.innerHTML = `<div class="flex-center" style="min-height:100vh"><p>Error: ${err.message}</p></div>`;
  }
}

function renderLesson(container) {
  const lesson = state.currentLesson;
  const vocabCount = lesson.vocabulary ? lesson.vocabulary.length : 0;
  const exerciseStepCount = state.currentPhase === 'exercise'
    ? (state.exerciseQueue.length || (lesson.exercises ? lesson.exercises.length : 0))
    : (lesson.exercises ? lesson.exercises.length : 0);
  const totalSteps = vocabCount + exerciseStepCount;
  let currentStep;
  if (state.currentPhase === 'vocab') {
    currentStep = state.vocabIndex;
  } else {
    currentStep = vocabCount + state.exerciseIndex;
  }
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  let contentHtml = '';
  if (state.currentPhase === 'vocab') {
    contentHtml = renderVocabCard();
  } else {
    contentHtml = renderExercise();
  }

  container.innerHTML = `
    <div class="lesson-screen">
      <div class="lesson-progress-bar">
        <div class="lesson-progress-fill" style="width: ${progress}%"></div>
      </div>
      <div class="lesson-header">
        <button class="btn btn-ghost" id="lesson-back">← Back</button>
        <span class="lesson-header-title">${lesson.icon || ''} ${lesson.title}</span>
        <span class="lesson-header-progress">${currentStep + 1} / ${totalSteps}</span>
      </div>
      <div class="lesson-content">
        <div class="lesson-inner" id="lesson-inner">
          ${contentHtml}
        </div>
      </div>
    </div>
  `;

  document.getElementById('lesson-back').addEventListener('click', () => {
    // Save progress before leaving
    if (canPersistProgress() && state.currentPhase === 'exercise' && state.exerciseIndex >= 0) {
      api('POST', '/api/progress/save', {
        lessonId: lesson.id,
        currentExercise: state.exerciseIndex,
        answers: {
          answerHistory: state.answers,
          exerciseQueue: state.exerciseQueue,
          retryCounts: state.retryCounts,
          masteredExercises: state.masteredExercises,
          score: state.score
        },
      });
    }
    navigate('/');
  });

  if (state.currentPhase === 'vocab') {
    setupVocabInteraction();
  } else {
    setupExerciseInteraction();
  }
}

// ─── Vocabulary Phase ──────────────────────────────────────
function renderVocabCard() {
  const lesson = state.currentLesson;
  const vocab = lesson.vocabulary || [];
  if (vocab.length === 0) {
    state.currentPhase = 'exercise';
    return renderExercise();
  }

  const v = vocab[state.vocabIndex];
  const isFirst = state.vocabIndex === 0;
  const isLast = state.vocabIndex === vocab.length - 1;

  const imageHtml = v.image
    ? `<img src="${v.image}" class="slide-animal-img" alt="${escapeHTML(v.romanian)}">`
    : `<div class="slide-animal-emoji">${v.emoji || lesson.icon || '🐾'}</div>`;

  return `
    <div class="slide-carousel-stage" id="slide-carousel-stage">
      <!-- Main Touchable Slide Card for 3yo -->
      <div class="slide-card-main" id="slide-card-touch" role="button" tabindex="0" title="Atinge pentru a auzi!">
        <div class="slide-animal-display" id="slide-animal-bounce">
          ${imageHtml}
        </div>
        <div class="slide-word-badge">
          <div class="slide-word-romanian">${escapeHTML(v.romanian)}</div>
          <div class="slide-word-english">${escapeHTML(v.english || '')}</div>
        </div>
        <div class="slide-audio-pills">
          <button class="slide-audio-pill normal" id="slide-audio-play" type="button">🔊 Ascultă</button>
          <button class="slide-audio-pill turtle" id="slide-audio-turtle" type="button">🐢 Încet</button>
        </div>
      </div>

      <!-- Slide Navigation Bar: Big arrows + touch dots -->
      <div class="slide-navigation-bar">
        <button class="slide-nav-btn prev" id="slide-btn-prev" type="button" ${isFirst ? 'disabled style="opacity:0.2; pointer-events:none;"' : ''} title="Înapoi">
          ◀
        </button>

        <div class="slide-dots-indicator" id="slide-dots-container">
          ${vocab.map((_, i) => `
            <button class="slide-dot${i === state.vocabIndex ? ' active' : ''}" data-idx="${i}" type="button" title="Slide ${i + 1}"></button>
          `).join('')}
        </div>

        <button class="slide-nav-btn next ${isLast ? 'finish-btn' : ''}" id="slide-btn-next" type="button" title="${isLast ? 'Hai la Joacă!' : 'Următorul'}">
          ${isLast ? '🎯 Joacă!' : '▶'}
        </button>
      </div>
    </div>
  `;
}

function setupVocabInteraction() {
  const vocab = state.currentLesson?.vocabulary || [];
  const v = vocab[state.vocabIndex];
  if (!v) return;

  const playCleanWord = (rate = 0.85) => {
    if (v.romanian) {
      speakRomanian(v.romanian, { rate });
    }
  };

  // 1. Touch anywhere on the animal/card -> immediate bounce + clean pronunciation + pop sound!
  const touchCard = document.getElementById('slide-card-touch');
  const bounceEl = document.getElementById('slide-animal-bounce');
  if (touchCard) {
    touchCard.addEventListener('click', () => {
      if (bounceEl) {
        bounceEl.classList.remove('animal-tap-bounce');
        void bounceEl.offsetWidth; // retrigger CSS animation
        bounceEl.classList.add('animal-tap-bounce');
      }
      playSound('match');
      playCleanWord(0.85);
    });
  }

  // 2. Audio button & turtle button
  document.getElementById('slide-audio-play')?.addEventListener('click', (e) => {
    e.stopPropagation();
    playSound('match');
    playCleanWord(0.85);
  });
  document.getElementById('slide-audio-turtle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    playSound('match');
    playCleanWord(0.6);
  });

  // 3. Auto-play clean word when slide opens (no extra prefixes)
  setTimeout(() => {
    playCleanWord(0.85);
  }, 220);

  // 4. Next & Prev buttons
  const goPrev = () => {
    if (state.vocabIndex > 0) {
      state.vocabIndex--;
      playSound('match');
      updateLessonContent();
    }
  };

  const goNext = () => {
    const totalVocab = state.currentLesson?.vocabulary || [];
    if (state.vocabIndex < totalVocab.length - 1) {
      state.vocabIndex++;
      playSound('match');
      updateLessonContent();
    } else {
      // Finished all slides -> proceed to exercises/games
      playSound('fanfare');
      state.currentPhase = 'exercise';
      state.exerciseIndex = 0;
      if (!state.exerciseQueue || state.exerciseQueue.length === 0) {
        const total = (state.currentLesson?.exercises || []).length;
        state.exerciseQueue = Array.from({ length: total }, (_, i) => i);
      }
      renderLesson(document.getElementById('app'));
    }
  };

  document.getElementById('slide-btn-prev')?.addEventListener('click', goPrev);
  document.getElementById('slide-btn-next')?.addEventListener('click', goNext);

  // 5. Direct dot tap
  document.querySelectorAll('.slide-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const idx = parseInt(dot.dataset.idx);
      if (!isNaN(idx) && idx !== state.vocabIndex) {
        state.vocabIndex = idx;
        playSound('match');
        updateLessonContent();
      }
    });
  });

  // 6. Touch swipe support for iPad & touchscreens
  const stage = document.getElementById('slide-carousel-stage');
  if (stage) {
    let startX = 0;
    let startY = 0;
    stage.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
    }, { passive: true });

    stage.addEventListener('touchend', (e) => {
      if (e.changedTouches.length > 0) {
        const deltaX = e.changedTouches[0].clientX - startX;
        const deltaY = e.changedTouches[0].clientY - startY;
        if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
          if (deltaX < 0) {
            goNext(); // Swipe left -> Next
          } else {
            goPrev(); // Swipe right -> Prev
          }
        }
      }
    }, { passive: true });
  }
}

// ─── Exercises Helper & Dispatcher ────────────────────────
function getCurrentExerciseId() {
  if (!state.exerciseQueue || state.exerciseQueue.length === 0) return -1;
  return state.exerciseQueue[state.exerciseIndex];
}

function getCurrentExercise() {
  const exercises = state.currentLesson?.exercises || [];
  const exId = getCurrentExerciseId();
  if (exId < 0 || exId >= exercises.length) return null;
  return exercises[exId];
}

function queueAdaptiveRetry(exerciseId) {
  const key = String(exerciseId);
  const attempts = Number(state.retryCounts[key] || 0);
  if (attempts >= state.maxAdaptiveRetries) return;
  state.retryCounts[key] = attempts + 1;
  state.exerciseQueue.push(exerciseId);
}

function recordAttempt(exerciseId, isCorrect, itemWord = null) {
  const key = String(exerciseId);
  const wasMastered = !!state.masteredExercises[key];
  state.answers.push(!!isCorrect);

  if (isCorrect) {
    if (!wasMastered) {
      state.masteredExercises[key] = true;
      state.score++;
    }
  } else {
    if (!wasMastered) queueAdaptiveRetry(exerciseId);
  }

  // Log attempt event to server for future-proof learning analytics
  if (state.currentLesson && state.currentLesson.id) {
    api('POST', '/api/attempts', {
      lessonId: state.currentLesson.id,
      exerciseId: key,
      itemWord: itemWord || null,
      tier: state.currentTier,
      isCorrect: !!isCorrect
    }).catch(() => {});
  }
}

function getOptionDetails(opt) {
  if (typeof opt === 'string') {
    const vocab = state.currentLesson?.vocabulary || [];
    const match = vocab.find(v =>
      (v.romanian && v.romanian.toLowerCase() === opt.toLowerCase()) ||
      (v.english && v.english.toLowerCase() === opt.toLowerCase())
    );
    return {
      text: opt,
      emoji: match?.emoji || '🌸',
      image: match?.image || null
    };
  }
  return {
    text: opt.text || opt.romanian || opt.english || '',
    emoji: opt.emoji || '🌸',
    image: opt.image || null
  };
}

function renderExercise() {
  if (state.exerciseIndex >= state.exerciseQueue.length) {
    return ''; // Completed
  }

  const ex = getCurrentExercise();
  if (!ex) return '<p>Exercițiul nu a fost găsit.</p>';

  // 🍼 BEBE TIER DISPATCH: Zero failure states, 2 large choices
  if (state.currentTier === 'bebe') {
    return renderBebeExercise(ex);
  }

  // 🌱 PRE-K TIER DISPATCH: 2x2 grid, gentle retry, turtle audio
  if (state.currentTier === 'prek' && (ex.type === 'listen_and_select' || ex.type === 'select_image')) {
    return renderPreKExercise(ex);
  }

  // ⭐ JUNIOR TIER DISPATCH: Word bubbles sentence builder, Picture-word match, typing with diacritics
  if (state.currentTier === 'junior') {
    if (ex.type === 'word_bubbles' || (ex.type === 'translate' && ex.sentence)) {
      return renderWordBubbles(ex);
    }
    if (ex.type === 'picture_word_match' || (ex.type === 'match' && ex.pairs)) {
      return renderPictureWordMatch(ex);
    }
  }

  switch (ex.type) {
    case 'word_bubbles':
      return renderWordBubbles(ex);
    case 'picture_word_match':
      return renderPictureWordMatch(ex);
    case 'multiple_choice':
    case 'multiple_choice_romanian':
      return renderMultipleChoice(ex);
    case 'match':
      return renderMatch(ex);
    case 'select_image':
      return renderSelectImage(ex);
    case 'listen_and_select':
      return renderListenAndSelect(ex);
    case 'type_answer':
    case 'translate':
      return renderTypeAnswer(ex);
    default:
      return renderMultipleChoice(ex);
  }
}

// ─── 🍼 BEBE EXERCISE: Zero Failure States ────────────────
function renderBebeExercise(ex) {
  const vocab = state.currentLesson?.vocabulary || [];
  let promptText = ex.prompt || (ex.options && ex.options[ex.correctAnswer] ? (ex.options[ex.correctAnswer].text || ex.options[ex.correctAnswer].romanian || ex.options[ex.correctAnswer]) : '');
  let rawOptions = ex.options || [];

  // If exercise has no options (e.g. was type/match), generate 2 choices from lesson vocab!
  if (rawOptions.length < 2 && vocab.length >= 2) {
    const targetWord = ex.answer || ex.sentence || (vocab[0] ? vocab[0].romanian : 'Cuvânt');
    promptText = promptText || targetWord;
    const targetVocab = vocab.find(v => v.romanian?.toLowerCase() === String(targetWord).toLowerCase()) || vocab[0];
    const altVocab = vocab.find(v => v !== targetVocab) || vocab[1];
    rawOptions = [
      { text: targetVocab.romanian, emoji: targetVocab.emoji, image: targetVocab.image },
      { text: altVocab.romanian, emoji: altVocab.emoji, image: altVocab.image }
    ];
    ex.correctAnswer = 0;
  }

  // Pick 2 options (correct answer + one alternate)
  let bebeOptions = [];
  if (rawOptions.length >= 2) {
    const correctIdx = typeof ex.correctAnswer === 'number' && ex.correctAnswer < rawOptions.length ? ex.correctAnswer : 0;
    const correctDetails = getOptionDetails(rawOptions[correctIdx]);
    const correctOpt = { ...correctDetails, isTarget: true, origIdx: correctIdx };

    const altIdx = correctIdx === 0 ? 1 : 0;
    const altDetails = getOptionDetails(rawOptions[altIdx]);
    const altOpt = { ...altDetails, isTarget: false, origIdx: altIdx };

    bebeOptions = Math.random() > 0.5 ? [correctOpt, altOpt] : [altOpt, correctOpt];
  } else {
    bebeOptions = rawOptions.map((o, idx) => ({ ...getOptionDetails(o), isTarget: true, origIdx: idx }));
  }

  return `
    <div class="bebe-prompt-stage">
      <div class="bebe-prompt-bubble">
        <button class="bebe-prompt-audio" id="listen-play-btn" type="button" title="Ascultă">🔊</button>
        <span class="bebe-prompt-word">${escapeHTML(promptText)}</span>
        <button class="bebe-prompt-turtle" id="listen-turtle-btn" type="button" title="Ascultă încet">🐢</button>
      </div>
    </div>

    <div class="bebe-choice-grid">
      ${bebeOptions.map((opt, i) => `
        <div class="bebe-choice-card" data-is-target="${opt.isTarget ? '1' : '0'}" data-text="${escapeHTML(opt.text)}" id="bebe-opt-${i}">
          ${opt.image ? `<img src="${opt.image}" style="max-height:120px;" alt="${escapeHTML(opt.text)}">` : `<div style="font-size:5.5rem;">${opt.emoji || '🌸'}</div>`}
          <div style="font-size:1.6rem; font-weight:900; margin-top:0.5rem; color:#1e293b;">${escapeHTML(opt.text)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function setupBebeExercise(ex) {
  const vocab = state.currentLesson?.vocabulary || [];
  let promptText = ex.prompt || (ex.options && ex.options[ex.correctAnswer] ? (ex.options[ex.correctAnswer].text || ex.options[ex.correctAnswer].romanian || ex.options[ex.correctAnswer]) : '');
  if (!promptText && vocab.length > 0) {
    promptText = vocab[0].romanian;
  }
  const exerciseId = getCurrentExerciseId();

  const playPromptNormal = () => {
    if (promptText) speakRomanian(promptText, { rate: 0.85 });
  };
  const playPromptSlow = () => {
    if (promptText) speakRomanian(promptText, { rate: 0.6 });
  };

  document.getElementById('listen-play-btn')?.addEventListener('click', playPromptNormal);
  document.getElementById('listen-turtle-btn')?.addEventListener('click', playPromptSlow);

  // Auto-play prompt on start
  setTimeout(playPromptNormal, 200);

  let answered = false;
  document.querySelectorAll('.bebe-choice-card').forEach(card => {
    card.addEventListener('click', () => {
      if (answered) return;
      const isTarget = card.dataset.isTarget === '1';
      const word = card.dataset.text;

      if (isTarget) {
        // Correct tap -> big celebration, zero penalty, clean animal name
        answered = true;
        card.classList.add('celebrate');
        playSound('fanfare');
        launchConfetti();
        showMascotBubble(`${word} 🐑🎉`);
        if (word) speakRomanian(word);
        recordAttempt(exerciseId, true, word);

        setTimeout(() => {
          state.exerciseIndex++;
          if (state.exerciseIndex >= state.exerciseQueue.length) {
            completeLesson();
          } else {
            renderLesson(document.getElementById('app'));
          }
        }, 900);
      } else {
        // Other option tap -> gentle bounce & name it cleanly without prefixes, NO failure state!
        card.classList.add('soft-react');
        playSound('match');
        showMascotBubble(`${word} 🐑✨`);
        if (word) speakRomanian(word);
        setTimeout(() => {
          card.classList.remove('soft-react');
        }, 600);
      }
    });
  });
}

// ─── 🌱 PRE-K EXERCISE: 2x2 Grid with Gentle Retry ────────
function renderPreKExercise(ex) {
  const promptText = ex.prompt || ex.question || '';
  const hideLabels = ex.hideLabels !== false && ex.type === 'listen_and_select';
  const options = (ex.options || []).map(opt => getOptionDetails(opt));

  return `
    <div class="mascot-bubble" id="mascot-reaction-bubble" style="margin-bottom:1rem">
      <span class="mascot-lamb">🐑</span>
      <span class="mascot-bubble-text">Ascultă și alege imaginea corectă!</span>
    </div>

    <div class="listen-prompt-card">
      <div class="audio-action-row">
        <button class="listen-play-btn" id="listen-play-btn" type="button">🔊 Ascultă / Play</button>
        <button class="btn btn-turtle" id="listen-turtle-btn" type="button">🐢 Încet (Slow)</button>
      </div>
      <div class="listen-instruction">${escapeHTML(ex.instruction || 'Apasă pe difuzor, apoi alege imaginea potrivită.')}</div>
      ${ex.showPromptText ? `<div class="listen-prompt-text">${escapeHTML(promptText)}</div>` : ''}
    </div>

    <div class="pre-k-2x2-grid ${hideLabels ? 'no-labels' : ''}">
      ${options.map((opt, i) => `
        <div class="image-option" data-index="${i}" id="img-opt-${i}" aria-label="${escapeHTML(opt.text || `opțiunea ${i + 1}`)}">
          ${opt.image ? `<img src="${opt.image}" alt="${escapeHTML(opt.text)}">` : `<div class="img-emoji">${opt.emoji}</div>`}
          <div class="image-label">${escapeHTML(opt.text)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function setupPreKExercise(ex) {
  const promptText = ex.prompt || '';
  const exerciseId = getCurrentExerciseId();

  const playPromptNormal = () => {
    if (promptText) speakRomanian(promptText, { rate: 0.82 });
  };
  const playPromptSlow = () => {
    if (promptText) speakRomanian(promptText, { rate: 0.6 });
  };

  document.getElementById('listen-play-btn')?.addEventListener('click', playPromptNormal);
  document.getElementById('listen-turtle-btn')?.addEventListener('click', playPromptSlow);

  // Auto-play audio on question start
  setTimeout(playPromptNormal, 250);

  const options = document.querySelectorAll('.image-option');
  let mastered = false;

  options.forEach(opt => {
    opt.addEventListener('click', () => {
      if (mastered) return;
      const idx = parseInt(opt.dataset.index);
      const isCorrect = idx === ex.correctAnswer;

      if (isCorrect) {
        mastered = true;
        opt.classList.add('correct');
        playSound('correct');
        launchConfetti();
        showMascotBubble('Bravo! Ești grozav! 🐑🎉');
        if (promptText) speakRomanian(promptText);
        recordAttempt(exerciseId, true);

        setTimeout(() => {
          state.exerciseIndex++;
          if (state.exerciseIndex >= state.exerciseQueue.length) {
            completeLesson();
          } else {
            renderLesson(document.getElementById('app'));
          }
        }, 900);
      } else {
        // Gentle retry without harsh penalty
        opt.classList.add('gentle-wiggle');
        playSound('incorrect');
        showMascotBubble('Aproape! Mai ascultă o dată și alege din nou! 🐑');
        if (promptText) {
          setTimeout(playPromptNormal, 350);
        }
        setTimeout(() => {
          opt.classList.remove('gentle-wiggle');
        }, 650);
      }
    });
  });
}

// ─── ⭐ JUNIOR: Word Bubbles Sentence Builder ───────────────
function renderWordBubbles(ex) {
  const rawSentence = ex.sentence || ex.answer || (ex.example && ex.example.romanian) || '';
  const cleanWords = rawSentence.replace(/[.,!?]/g, '').trim().split(/\s+/).filter(Boolean);
  // Scramble word chips
  const scrambled = [...cleanWords].sort(() => Math.random() - 0.5);

  return `
    <div class="exercise-question">🧩 Construiește propoziția în ordine:</div>
    <div class="mascot-bubble" id="mascot-reaction-bubble" style="margin-bottom:1rem">
      <span class="mascot-lamb">🐑</span>
      <span class="mascot-bubble-text">Apasă pe bulele cu cuvinte în ordinea corectă!</span>
    </div>

    <div class="word-bubbles-box">
      <!-- Target sentence tray -->
      <div class="sentence-builder-tray" id="sentence-builder-tray">
        <span class="sentence-builder-placeholder" id="tray-placeholder">Apasă pe cuvinte pentru a le așeza aici...</span>
      </div>

      <!-- Scrambled chips pool -->
      <div class="word-chips-pool" id="word-chips-pool">
        ${scrambled.map((w, i) => `
          <button type="button" class="word-bubble-chip" data-word="${escapeHTML(w)}" data-index="${i}">
            ${escapeHTML(w)} 🔊
          </button>
        `).join('')}
      </div>

      <div class="audio-action-row" style="margin-top:1.25rem;">
        <button class="btn btn-turtle" id="bubbles-listen-slow" type="button">🐢 Ascultă încet propoziția</button>
        <button class="btn btn-outline" id="bubbles-reset" type="button">🔄 Reset</button>
      </div>
    </div>

    <div class="type-answer-submit text-center">
      <button class="btn btn-primary btn-lg" id="bubbles-submit">Verifică Propoziția ✓</button>
    </div>
    <div class="type-answer-feedback hidden" id="bubbles-feedback"></div>
    <div class="exercise-continue hidden" id="ex-continue">
      <button class="btn btn-primary btn-lg" id="continue-btn">Continuă →</button>
    </div>
  `;
}

function setupWordBubbles(ex) {
  const targetSentence = (ex.sentence || ex.answer || (ex.example && ex.example.romanian) || '')
    .replace(/[.,!?]/g, '').trim().toLowerCase();
  const tray = document.getElementById('sentence-builder-tray');
  const pool = document.getElementById('word-chips-pool');
  const placeholder = document.getElementById('tray-placeholder');
  const submitBtn = document.getElementById('bubbles-submit');
  const feedback = document.getElementById('bubbles-feedback');
  const slowBtn = document.getElementById('bubbles-listen-slow');
  const resetBtn = document.getElementById('bubbles-reset');
  const exerciseId = getCurrentExerciseId();

  let placedWords = [];

  slowBtn?.addEventListener('click', () => {
    if (ex.sentence || ex.answer) speakRomanian(ex.sentence || ex.answer, { rate: 0.6 });
  });

  const updateTrayView = () => {
    tray.querySelectorAll('.word-bubble-chip.in-tray').forEach(c => c.remove());
    if (placedWords.length === 0) {
      if (placeholder) placeholder.style.display = 'block';
      tray.classList.remove('has-items');
    } else {
      if (placeholder) placeholder.style.display = 'none';
      tray.classList.add('has-items');

      placedWords.forEach((item, pos) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'word-bubble-chip in-tray';
        chip.textContent = `${item.word} ✕`;
        chip.title = 'Apasă pentru a scoate cuvântul';
        chip.addEventListener('click', () => {
          // Return word back to pool
          placedWords.splice(pos, 1);
          item.origEl.classList.remove('placed');
          playSound('match');
          updateTrayView();
        });
        tray.appendChild(chip);
      });
    }
  };

  pool?.querySelectorAll('.word-bubble-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (chip.classList.contains('placed')) return;
      const word = chip.dataset.word;
      placedWords.push({ word, origEl: chip });
      chip.classList.add('placed');
      playSound('match');
      if (word) speakRomanian(word);
      updateTrayView();
    });
  });

  resetBtn?.addEventListener('click', () => {
    placedWords = [];
    pool?.querySelectorAll('.word-bubble-chip').forEach(c => c.classList.remove('placed'));
    updateTrayView();
  });

  submitBtn?.addEventListener('click', () => {
    const userBuilt = placedWords.map(w => w.word).join(' ').trim().toLowerCase();
    const isCorrect = userBuilt === targetSentence;

    feedback.classList.remove('hidden');
    if (isCorrect) {
      feedback.className = 'type-answer-feedback correct';
      feedback.textContent = '✅ Bravo! Ai construit propoziția corect!';
      playSound('correct');
      launchConfetti();
      submitBtn.style.display = 'none';
      recordAttempt(exerciseId, true);
    } else {
      feedback.className = 'type-answer-feedback incorrect';
      feedback.innerHTML = `❌ Mai încearcă! Ascultă propoziția cu 🐢 și aranjează din nou.`;
      playSound('incorrect');
      recordAttempt(exerciseId, false);
    }

    setTimeout(() => {
      document.getElementById('ex-continue').classList.remove('hidden');
      setupContinueButton();
    }, 500);
  });
}

// ─── ⭐ JUNIOR: Picture-Word Match ─────────────────────────
function renderPictureWordMatch(ex) {
  const pairs = ex.pairs || [];
  const leftPictures = [...pairs].sort(() => Math.random() - 0.5);
  const rightWords = [...pairs].sort(() => Math.random() - 0.5);

  return `
    <div class="exercise-question">🖼️ Potrivește imaginea cu cuvântul românesc!</div>
    <div class="picture-word-container">
      <div id="pw-pictures-column" style="display:flex; flex-direction:column; gap:0.75rem;">
        ${leftPictures.map((p, i) => `
          <div class="picture-card-item" data-side="pic" data-pair="${pairs.indexOf(p)}" data-word="${escapeHTML(p.romanian)}">
            <div class="picture-card-emoji">${p.emoji || '🐾'}</div>
          </div>
        `).join('')}
      </div>
      <div id="pw-words-column" style="display:flex; flex-direction:column; gap:0.75rem;">
        ${rightWords.map((p, i) => `
          <div class="match-item" data-side="word" data-pair="${pairs.indexOf(p)}" data-word="${escapeHTML(p.romanian)}" style="min-height:70px; display:flex; align-items:center; justify-content:center; font-size:1.25rem;">
            ${escapeHTML(p.romanian)} 🔊
          </div>
        `).join('')}
      </div>
    </div>
    <div class="exercise-continue hidden" id="ex-continue">
      <button class="btn btn-primary btn-lg" id="continue-btn">Continuă →</button>
    </div>
  `;
}

function setupPictureWordMatch(ex) {
  const exerciseId = getCurrentExerciseId();
  let selectedPic = null;
  let selectedWord = null;
  let matchedCount = 0;
  const total = (ex.pairs || []).length;

  const items = document.querySelectorAll('.picture-card-item, .match-item');
  items.forEach(el => {
    el.addEventListener('click', () => {
      if (el.classList.contains('matched')) return;

      const side = el.dataset.side;
      if (side === 'pic') {
        if (selectedPic) selectedPic.classList.remove('selected');
        selectedPic = el;
        el.classList.add('selected');
      } else {
        if (selectedWord) selectedWord.classList.remove('selected');
        selectedWord = el;
        el.classList.add('selected');
        const wordText = el.dataset.word;
        if (wordText) speakRomanian(wordText);
      }

      if (selectedPic && selectedWord) {
        const picPair = selectedPic.dataset.pair;
        const wordPair = selectedWord.dataset.pair;

        if (picPair === wordPair) {
          playSound('match');
          selectedPic.classList.remove('selected');
          selectedWord.classList.remove('selected');
          selectedPic.classList.add('matched');
          selectedWord.classList.add('matched');
          matchedCount++;

          selectedPic = null;
          selectedWord = null;

          if (matchedCount === total) {
            playSound('fanfare');
            recordAttempt(exerciseId, true);
            setTimeout(() => {
              document.getElementById('ex-continue').classList.remove('hidden');
              setupContinueButton();
            }, 400);
          }
        } else {
          playSound('incorrect');
          selectedPic.classList.add('wrong');
          selectedWord.classList.add('wrong');
          const p = selectedPic;
          const w = selectedWord;
          setTimeout(() => {
            p.classList.remove('wrong', 'selected');
            w.classList.remove('wrong', 'selected');
          }, 500);
          selectedPic = null;
          selectedWord = null;
        }
      }
    });
  });
}

// ─── Standard Multiple Choice ──────────────────────────────
function renderMultipleChoice(ex) {
  const qLabel = ex.type === 'multiple_choice_romanian'
    ? `🇷🇴 ${escapeHTML(ex.question)}`
    : `🇬🇧 ${escapeHTML(ex.question)}`;

  return `
    <div class="exercise-question">${qLabel}</div>
    <div class="mc-options">
      ${ex.options.map((opt, i) => `
        <button class="mc-option" data-index="${i}" id="mc-opt-${i}">${escapeHTML(opt)}</button>
      `).join('')}
    </div>
    <div class="exercise-continue hidden" id="ex-continue">
      <button class="btn btn-primary btn-lg" id="continue-btn">Continuă →</button>
    </div>
  `;
}

function renderMatch(ex) {
  const pairs = ex.pairs || [];
  const leftItems = [...pairs].sort(() => Math.random() - 0.5);
  const rightItems = [...pairs].sort(() => Math.random() - 0.5);

  return `
    <div class="exercise-question">${escapeHTML(ex.instruction || 'Potrivește perechile!')}</div>
    <div class="match-container">
      <div>
        <div class="match-column-label">🇷🇴 Română</div>
        <div class="match-column" id="match-left">
          ${leftItems.map((p, i) => `<div class="match-item" data-side="left" data-value="${escapeHTML(p.romanian)}" data-pair="${pairs.indexOf(p)}" id="match-left-${i}">${escapeHTML(p.romanian)}</div>`).join('')}
        </div>
      </div>
      <div>
        <div class="match-column-label">🇬🇧 English</div>
        <div class="match-column" id="match-right">
          ${rightItems.map((p, i) => `<div class="match-item" data-side="right" data-value="${escapeHTML(p.english)}" data-pair="${pairs.indexOf(p)}" id="match-right-${i}">${escapeHTML(p.english)}</div>`).join('')}
        </div>
      </div>
    </div>
    <div class="exercise-continue hidden" id="ex-continue">
      <button class="btn btn-primary btn-lg" id="continue-btn">Continuă →</button>
    </div>
  `;
}

function renderSelectImage(ex) {
  return `
    <div class="exercise-question">🖼️ ${escapeHTML(ex.question)}</div>
    <div class="image-options">
      ${ex.options.map((opt, i) => `
        <div class="image-option" data-index="${i}" id="img-opt-${i}">
          ${opt.image ? `<img src="${opt.image}" alt="${escapeHTML(opt.text)}">` : `<div class="img-emoji">${opt.emoji || '❓'}</div>`}
          <div class="image-label">${escapeHTML(opt.text)}</div>
        </div>
      `).join('')}
    </div>
    <div class="exercise-continue hidden" id="ex-continue">
      <button class="btn btn-primary btn-lg" id="continue-btn">Continuă →</button>
    </div>
  `;
}

function renderListenAndSelect(ex) {
  const promptText = ex.prompt || '';
  const hideLabels = ex.hideLabels !== false;
  return `
    <div class="exercise-question">👂 Ascultă și alege imaginea corectă</div>
    <div class="listen-prompt-card">
      <div class="audio-action-row">
        <button class="listen-play-btn" id="listen-play-btn" type="button">🔊 Ascultă / Play</button>
        <button class="btn btn-turtle" id="listen-turtle-btn" type="button">🐢 Încet (Slow)</button>
      </div>
      <div class="listen-instruction">${escapeHTML(ex.instruction || 'Apasă pe difuzor, apoi alege opțiunea potrivită.')}</div>
      ${ex.showPromptText ? `<div class="listen-prompt-text">${escapeHTML(promptText)}</div>` : ''}
    </div>
    <div class="image-options pre-k-options${hideLabels ? ' no-labels' : ''}">
      ${ex.options.map((opt, i) => `
        <div class="image-option" data-index="${i}" id="img-opt-${i}" aria-label="${escapeHTML(opt.text || `opțiunea ${i + 1}`)}">
          ${opt.image ? `<img src="${opt.image}" alt="${escapeHTML(opt.text || '')}">` : `<div class="img-emoji">${opt.emoji || '❓'}</div>`}
          <div class="image-label">${escapeHTML(opt.text || '')}</div>
        </div>
      `).join('')}
    </div>
    <div class="exercise-continue hidden" id="ex-continue">
      <button class="btn btn-primary btn-lg" id="continue-btn">Continuă →</button>
    </div>
  `;
}

// ─── Sticky Diacritics Bar Above Text Inputs ──────────────
function renderTypeAnswer(ex) {
  const question = ex.type === 'translate'
    ? `📝 ${escapeHTML(ex.instruction || 'Tradu:')}<br><strong style="font-size:1.5rem;color:var(--primary)">${escapeHTML(ex.sentence)}</strong>`
    : `✍️ ${escapeHTML(ex.question)}`;

  return `
    <div class="exercise-question">${question}</div>

    <!-- Sticky on-screen diacritics bar for Romanian keys [ă] [â] [î] [ș] [ț] -->
    <div class="diacritics-bar" id="diacritics-bar">
      <button type="button" class="diacritic-key" data-char="ă">ă</button>
      <button type="button" class="diacritic-key" data-char="â">â</button>
      <button type="button" class="diacritic-key" data-char="î">î</button>
      <button type="button" class="diacritic-key" data-char="ș">ș</button>
      <button type="button" class="diacritic-key" data-char="ț">ț</button>
    </div>

    <input type="text" class="type-answer-input" id="type-input" placeholder="Tastează răspunsul tău..." autocomplete="off" autocapitalize="off" spellcheck="false">
    <div class="type-answer-submit text-center">
      <button class="btn btn-primary btn-lg" id="type-submit">Verifică Răspunsul ✓</button>
    </div>
    <div class="type-answer-feedback hidden" id="type-feedback"></div>
    <div class="exercise-continue hidden" id="ex-continue">
      <button class="btn btn-primary btn-lg" id="continue-btn">Continuă →</button>
    </div>
  `;
}

function setupExerciseInteraction() {
  if (state.exerciseIndex >= state.exerciseQueue.length) {
    completeLesson();
    return;
  }

  const ex = getCurrentExercise();
  if (!ex) {
    completeLesson();
    return;
  }

  if (state.currentTier === 'bebe') {
    setupBebeExercise(ex);
    return;
  }

  if (state.currentTier === 'prek' && (ex.type === 'listen_and_select' || ex.type === 'select_image')) {
    setupPreKExercise(ex);
    return;
  }

  if (state.currentTier === 'junior') {
    if (ex.type === 'word_bubbles' || (ex.type === 'translate' && ex.sentence)) {
      setupWordBubbles(ex);
      return;
    }
    if (ex.type === 'picture_word_match' || (ex.type === 'match' && ex.pairs)) {
      setupPictureWordMatch(ex);
      return;
    }
  }

  switch (ex.type) {
    case 'word_bubbles':
      setupWordBubbles(ex);
      break;
    case 'picture_word_match':
      setupPictureWordMatch(ex);
      break;
    case 'multiple_choice':
    case 'multiple_choice_romanian':
      setupMultipleChoice(ex);
      break;
    case 'match':
      setupMatch(ex);
      break;
    case 'select_image':
      setupSelectImage(ex);
      break;
    case 'listen_and_select':
      setupListenAndSelect(ex);
      break;
    case 'type_answer':
    case 'translate':
      setupTypeAnswer(ex);
      break;
  }
}

function setupMultipleChoice(ex) {
  const options = document.querySelectorAll('.mc-option');
  const exerciseId = getCurrentExerciseId();
  let answered = false;

  options.forEach(opt => {
    opt.addEventListener('click', () => {
      if (answered) return;
      answered = true;

      const idx = parseInt(opt.dataset.index);
      const correct = idx === ex.correctAnswer;

      options.forEach(o => o.classList.add('disabled'));

      if (correct) {
        opt.classList.add('correct');
        playSound('correct');
        if (ex.type === 'multiple_choice_romanian' && opt.textContent) {
          speakRomanian(opt.textContent);
        }
      } else {
        opt.classList.add('incorrect');
        playSound('incorrect');
        options[ex.correctAnswer]?.classList.add('show-correct');
      }
      recordAttempt(exerciseId, correct);

      setTimeout(() => {
        document.getElementById('ex-continue')?.classList.remove('hidden');
        setupContinueButton();
      }, 600);
    });
  });
}

function setupMatch(ex) {
  const exerciseId = getCurrentExerciseId();
  let selectedLeft = null;
  let selectedRight = null;
  let matchedCount = 0;
  const pairs = ex.pairs || [];
  const totalPairs = pairs.length;
  let matchErrors = 0;

  document.querySelectorAll('.match-item').forEach(item => {
    item.addEventListener('click', () => {
      if (item.classList.contains('matched')) return;

      const side = item.dataset.side;
      if (side === 'left') {
        if (selectedLeft) selectedLeft.classList.remove('selected');
        selectedLeft = item;
        item.classList.add('selected');
      } else {
        if (selectedRight) selectedRight.classList.remove('selected');
        selectedRight = item;
        item.classList.add('selected');
      }

      if (selectedLeft && selectedRight) {
        const leftPair = parseInt(selectedLeft.dataset.pair);
        const rightPair = parseInt(selectedRight.dataset.pair);

        if (leftPair === rightPair) {
          playSound('match');
          const romanianText = selectedLeft.dataset.value;
          if (romanianText) speakRomanian(romanianText);

          selectedLeft.classList.remove('selected');
          selectedRight.classList.remove('selected');
          selectedLeft.classList.add('matched');
          selectedRight.classList.add('matched');
          matchedCount++;

          selectedLeft = null;
          selectedRight = null;

          if (matchedCount === totalPairs) {
            const correct = matchErrors < totalPairs;
            playSound('correct');
            recordAttempt(exerciseId, correct);
            setTimeout(() => {
              document.getElementById('ex-continue')?.classList.remove('hidden');
              setupContinueButton();
            }, 400);
          }
        } else {
          playSound('incorrect');
          matchErrors++;
          selectedLeft.classList.add('wrong');
          selectedRight.classList.add('wrong');
          const l = selectedLeft;
          const r = selectedRight;
          setTimeout(() => {
            l.classList.remove('wrong', 'selected');
            r.classList.remove('wrong', 'selected');
          }, 500);
          selectedLeft = null;
          selectedRight = null;
        }
      }
    });
  });
}

function setupSelectImage(ex) {
  const options = document.querySelectorAll('.image-option');
  const exerciseId = getCurrentExerciseId();
  let answered = false;

  options.forEach(opt => {
    opt.addEventListener('click', () => {
      if (answered) return;
      answered = true;

      const idx = parseInt(opt.dataset.index);
      const correct = idx === ex.correctAnswer;

      options.forEach(o => o.style.pointerEvents = 'none');

      if (correct) {
        opt.classList.add('correct');
        playSound('correct');
        launchConfetti();
      } else {
        opt.classList.add('incorrect');
        playSound('incorrect');
        const correctOpt = document.getElementById(`img-opt-${ex.correctAnswer}`);
        if (correctOpt) correctOpt.classList.add('show-correct');
      }
      recordAttempt(exerciseId, correct);

      setTimeout(() => {
        document.getElementById('ex-continue')?.classList.remove('hidden');
        setupContinueButton();
      }, 500);
    });
  });
}

function setupListenAndSelect(ex) {
  setupSelectImage(ex);
  const promptText = ex.prompt || '';
  const playBtn = document.getElementById('listen-play-btn');
  const turtleBtn = document.getElementById('listen-turtle-btn');

  playBtn?.addEventListener('click', () => {
    speakRomanian(promptText, { rate: 0.82 });
  });

  turtleBtn?.addEventListener('click', () => {
    speakRomanian(promptText, { rate: 0.6 });
  });

  if (ex.autoPlay) {
    setTimeout(() => speakRomanian(promptText, { rate: 0.82 }), 250);
  }
}

function setupTypeAnswer(ex) {
  const input = document.getElementById('type-input');
  const submitBtn = document.getElementById('type-submit');
  const feedback = document.getElementById('type-feedback');
  const exerciseId = getCurrentExerciseId();
  let answered = false;

  // On-screen sticky diacritics keys
  document.querySelectorAll('.diacritic-key').forEach(key => {
    key.addEventListener('click', (e) => {
      e.preventDefault();
      if (!input || input.disabled) return;
      const char = key.dataset.char;
      const start = input.selectionStart || input.value.length;
      const end = input.selectionEnd || input.value.length;
      input.value = input.value.substring(0, start) + char + input.value.substring(end);
      input.selectionStart = input.selectionEnd = start + char.length;
      input.focus();
      playSound('match');
    });
  });

  function checkAnswer() {
    if (answered) return;
    answered = true;

    const stripDiacritics = (str) => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    const userAnswer = input.value.trim();
    const correctAnswer = ex.answer || ex.sentence;
    const alternatives = ex.acceptAlternatives || [];
    const allAccepted = [correctAnswer, ...alternatives].map(a => a.toLowerCase().trim());

    const isExactCorrect = allAccepted.some(a => a.toLowerCase().trim() === userAnswer.toLowerCase().trim());
    const isAlmostCorrect = !isExactCorrect && allAccepted.some(a => stripDiacritics(a) === stripDiacritics(userAnswer));
    const isCorrect = isExactCorrect || isAlmostCorrect;

    input.disabled = true;
    submitBtn.style.display = 'none';
    feedback.classList.remove('hidden');

    if (isExactCorrect) {
      input.classList.add('correct');
      playSound('correct');
      feedback.className = 'type-answer-feedback correct';
      feedback.textContent = '✅ Corect! Excelent!';
    } else if (isAlmostCorrect) {
      input.classList.add('correct');
      playSound('correct');
      feedback.className = 'type-answer-feedback correct';
      feedback.innerHTML = `✨ Foarte aproape! Ai uitat diacriticele (<strong>${escapeHTML(correctAnswer)}</strong>). Bravo!`;
    } else {
      input.classList.add('incorrect');
      playSound('incorrect');
      feedback.className = 'type-answer-feedback incorrect';
      feedback.innerHTML = `❌ Răspunsul corect este: <strong>${escapeHTML(correctAnswer)}</strong>`;
    }
    recordAttempt(exerciseId, isCorrect, correctAnswer);

    setTimeout(() => {
      document.getElementById('ex-continue')?.classList.remove('hidden');
      setupContinueButton();
    }, 400);
  }

  submitBtn?.addEventListener('click', checkAnswer);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkAnswer();
  });

  setTimeout(() => input?.focus(), 100);
}

function setupContinueButton() {
  document.getElementById('continue-btn')?.addEventListener('click', () => {
    state.exerciseIndex++;

    if (state.exerciseIndex >= state.exerciseQueue.length) {
      completeLesson();
    } else {
      if (canPersistProgress()) {
        api('POST', '/api/progress/save', {
          lessonId: state.currentLesson.id,
          currentExercise: state.exerciseIndex,
          answers: {
            answerHistory: state.answers,
            exerciseQueue: state.exerciseQueue,
            retryCounts: state.retryCounts,
            masteredExercises: state.masteredExercises,
            score: state.score
          },
        }).catch(() => { });
      }
      renderLesson(document.getElementById('app'));
    }
  });
}

function updateLessonContent() {
  const inner = document.getElementById('lesson-inner');
  if (!inner) return;

  if (state.currentPhase === 'vocab') {
    inner.innerHTML = renderVocabCard();
    setupVocabInteraction();
  } else {
    inner.innerHTML = renderExercise();
    setupExerciseInteraction();
  }

  const lesson = state.currentLesson;
  const vocabCount = lesson.vocabulary ? lesson.vocabulary.length : 0;
  const exerciseStepCount = state.currentPhase === 'exercise'
    ? (state.exerciseQueue.length || (lesson.exercises ? lesson.exercises.length : 0))
    : (lesson.exercises ? lesson.exercises.length : 0);
  const totalSteps = vocabCount + exerciseStepCount;
  let currentStep = state.currentPhase === 'vocab' ? state.vocabIndex : vocabCount + state.exerciseIndex;
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
  const fill = document.querySelector('.lesson-progress-fill');
  if (fill) fill.style.width = `${progress}%`;

  const counter = document.querySelector('.lesson-header-progress');
  if (counter) counter.textContent = `${currentStep + 1} / ${totalSteps}`;
}

function getNextLessonId(currentLessonId) {
  if (!state.lessons || state.lessons.length === 0) return null;
  const sorted = [...state.lessons].sort((a, b) => (a.order || 999) - (b.order || 999));
  const idx = sorted.findIndex(l => l.id === currentLessonId);
  if (idx < 0 || idx >= sorted.length - 1) return null;
  return sorted[idx + 1].id;
}

// ─── Lesson Completion (Tier-specific celebrations & stickers)
async function completeLesson() {
  const lesson = state.currentLesson;
  const total = lesson.exercises ? lesson.exercises.length : 0;
  const percentage = total > 0 ? Math.round((state.score / total) * 100) : 100;
  const timeSpent = Math.round((Date.now() - state.lessonStartTime) / 1000);
  const nextLessonId = getNextLessonId(lesson.id);
  clearAutoProgressTimer();

  // Send results to server if registered student
  if (canPersistProgress()) {
    try {
      await api('POST', '/api/progress/complete', {
        lessonId: lesson.id,
        score: state.score,
        totalQuestions: total,
        timeSpentSec: timeSpent,
        tier: state.currentTier,
      });
    } catch (err) {
      console.error('Failed to save results:', err);
    }
  }

  // Award a sticker reward!
  const newSticker = await unlockStickerReward(lesson.id);

  // 🍼 BEBE TIER RESULT: Zero failure states, pure joyful celebration!
  if (state.currentTier === 'bebe') {
    playSound('fanfare');
    launchConfetti();

    const container = document.getElementById('app');
    container.innerHTML = `
      <div class="results-screen">
        <div class="results-card" style="border:4px solid #bbf7d0;">
          <div class="results-icon" style="animation:mascotBounce 1s infinite ease-in-out;">🐑🎉</div>
          <div class="results-title" style="color:#16a34a; font-size:2.2rem;">Bravo, pui mic! 👏</div>
          <div class="results-subtitle" style="font-size:1.2rem; font-weight:700;">Ai explorat minunat cu Mielul!</div>

          ${newSticker ? `
            <div class="card mt-2 mb-2" style="background:#fffbeb; border:3px solid #ffd166; border-radius:24px; padding:1.25rem;">
              <div style="font-weight:900; color:#b45309; font-size:1.1rem; margin-bottom:0.25rem;">🎁 Ai primit un abțibild nou!</div>
              <div style="font-size:4.5rem; animation:starPop 0.6s ease;">${newSticker.emoji}</div>
              <div style="font-size:1.35rem; font-weight:900; color:#1e293b;">${escapeHTML(newSticker.word)}</div>
            </div>
          ` : ''}

          <div class="results-actions" style="margin-top:1.5rem;">
            <button class="btn btn-primary btn-lg btn-block" id="results-retry" style="font-size:1.2rem; padding:1.1rem;">🔄 Mai vrei o dată?</button>
            <button class="btn btn-outline btn-lg btn-block" id="results-stickers">🌟 Vezi Albumul de Abțibilduri</button>
            <button class="btn btn-ghost btn-lg btn-block" id="results-home">🏠 Înapoi la Lume</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('results-retry')?.addEventListener('click', () => navigate(`/lesson/${lesson.id}`));
    document.getElementById('results-stickers')?.addEventListener('click', () => openStickerAlbumModal());
    document.getElementById('results-home')?.addEventListener('click', () => navigate('/'));
    return;
  }

  // 🌱 PRE-K & ⭐ JUNIOR RESULTS
  let icon = '🏆', title = 'Excelent!', subtitle = 'Ești foarte isteț!', color = '#FFD700';
  let starsEarned = 0;

  if (percentage >= 95) {
    starsEarned = 3;
    icon = '🏆'; title = 'Excelent!'; subtitle = 'Mielul este mândru de tine!'; color = '#FFD700';
    playSound('fanfare');
    launchConfetti();
  } else if (percentage >= 80) {
    starsEarned = 2;
    icon = '⭐'; title = 'Foarte Bine!'; subtitle = 'Ai învățat grozav!'; color = 'var(--accent-teal)';
    playSound('correct');
    launchConfetti();
  } else if (percentage >= 60) {
    starsEarned = 1;
    icon = '👍'; title = 'Bine!'; subtitle = 'Continuă tot așa!'; color = 'var(--accent-orange)';
  } else {
    starsEarned = 0;
    icon = '💪'; title = 'Încearcă din nou!'; subtitle = 'Exercițiul te face maestru!'; color = 'var(--accent-coral)';
  }

  const circumference = 2 * Math.PI * 60;
  const offset = circumference * (1 - percentage / 100);
  const minutes = Math.floor(timeSpent / 60);
  const seconds = timeSpent % 60;

  const container = document.getElementById('app');
  container.innerHTML = `
    <div class="results-screen">
      <div class="results-card">
        <div class="results-icon">${icon}</div>
        <div class="results-title">${title}</div>
        <div class="results-subtitle">${subtitle}</div>

        <!-- Star Row for Junior -->
        ${state.currentTier === 'junior' ? `
          <div class="stars-row">
            <span class="star-badge-item ${starsEarned >= 1 ? 'earned' : ''}">⭐</span>
            <span class="star-badge-item ${starsEarned >= 2 ? 'earned' : ''}">⭐</span>
            <span class="star-badge-item ${starsEarned >= 3 ? 'earned' : ''}">⭐</span>
          </div>
        ` : ''}

        <div class="score-circle">
          <svg width="150" height="150" viewBox="0 0 150 150">
            <circle class="circle-bg" cx="75" cy="75" r="60"/>
            <circle class="circle-fill" cx="75" cy="75" r="60"
              stroke="${color}"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${offset}"/>
          </svg>
          <div class="score-circle-text" style="color:${color}">${percentage}%</div>
        </div>

        <div class="results-stats">
          <div class="results-stat-item">
            <div class="results-stat-value">${state.score}/${total}</div>
            <div class="results-stat-label">Corecte</div>
          </div>
          <div class="results-stat-item">
            <div class="results-stat-value">${minutes}:${seconds.toString().padStart(2, '0')}</div>
            <div class="results-stat-label">Timp</div>
          </div>
        </div>

        ${newSticker ? `
          <div class="card mt-2 mb-2" style="background:#fffbeb; border:2px solid #ffd166; border-radius:20px; padding:1rem; cursor:pointer;" id="results-sticker-preview">
            <div style="font-weight:800; color:#b45309; font-size:0.95rem;">🎁 Abțibild nou deblocat!</div>
            <div style="font-size:3.5rem; margin:0.25rem 0;">${newSticker.emoji}</div>
            <div style="font-weight:900; color:#1e293b;">${escapeHTML(newSticker.word)}</div>
            <div style="font-size:0.8rem; color:#78350f;">Apasă pentru album</div>
          </div>
        ` : ''}

        <div class="results-actions">
          <button class="btn btn-primary btn-lg btn-block" id="results-retry">🔄 Repetă Lecția</button>
          ${nextLessonId ? `<button class="btn btn-success btn-lg btn-block" id="results-next">➡️ Următoarea Lecție</button>` : ''}
          <button class="btn btn-outline btn-lg btn-block" id="results-stickers-btn">🌟 Album Abțibilduri</button>
          <button class="btn btn-ghost btn-lg btn-block" id="results-home">🏠 Acasă</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('results-retry')?.addEventListener('click', () => {
    clearAutoProgressTimer();
    navigate(`/lesson/${lesson.id}`);
  });
  document.getElementById('results-next')?.addEventListener('click', () => {
    clearAutoProgressTimer();
    navigate(`/lesson/${nextLessonId}`);
  });
  document.getElementById('results-stickers-btn')?.addEventListener('click', () => {
    openStickerAlbumModal();
  });
  document.getElementById('results-sticker-preview')?.addEventListener('click', () => {
    openStickerAlbumModal();
  });
  document.getElementById('results-home')?.addEventListener('click', () => {
    clearAutoProgressTimer();
    navigate('/');
  });

  if (nextLessonId && percentage >= 80) {
    state.autoProgressTimer = setTimeout(() => {
      navigate(`/lesson/${nextLessonId}`);
    }, 4500);
  }
}

// ═══════════════════════════════════════════════════════════
//  PARENT DASHBOARD
// ═══════════════════════════════════════════════════════════

async function renderParentDashboard(container) {
  if (!['parent', 'admin'].includes(state.user.role)) {
    navigate('/');
    return;
  }

  try {
    const [usersData, resultsData, lessonsData] = await Promise.all([
      api('GET', '/api/users'),
      api('GET', '/api/progress/all-results'),
      api('GET', '/api/lessons'),
    ]);

    const users = usersData.users;
    const results = resultsData.results;
    const lessons = lessonsData.lessons;
    const isAdmin = state.user.role === 'admin';

    container.innerHTML = `
      ${renderNavbar()}
      <div class="parent-dash">
        <div class="hero">
          <h1>${isAdmin ? '🛡️ Admin Dashboard' : '📊 Parent Dashboard'}</h1>
          <p>${isAdmin ? 'Manage users/lessons and monitor site activity' : 'Track your children\'s progress and manage lessons'}</p>
        </div>

        <div class="parent-tabs">
          <button class="parent-tab active" data-tab="progress">📈 Progress</button>
          <button class="parent-tab" data-tab="users">👥 Users</button>
          <button class="parent-tab" data-tab="lessons-manage">📚 Manage Lessons</button>
          ${isAdmin ? '<button class="parent-tab" data-tab="analytics">🌐 Site Analytics</button>' : ''}
        </div>

        <div id="tab-content"></div>
      </div>
    `;

    setupNavbar();

    // Tab switching
    let activeTab = 'progress';
    document.querySelectorAll('.parent-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.parent-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeTab = tab.dataset.tab;
        void renderTab(activeTab);
      });
    });

    async function renderTab(tab) {
      const content = document.getElementById('tab-content');
      switch (tab) {
        case 'progress': renderProgressTab(content, users, results, lessons); break;
        case 'users': renderUsersTab(content, users); break;
        case 'lessons-manage': renderLessonsTab(content, lessons); break;
        case 'analytics': await renderAdminAnalyticsTab(content); break;
      }
    }

    await renderTab(activeTab);
  } catch (err) {
    container.innerHTML = `<div class="flex-center" style="min-height:100vh"><p>Error: ${err.message}</p></div>`;
  }
}

function renderProgressTab(container, users, results, lessons) {
  const students = users.filter(u => u.role === 'student');

  container.innerHTML = `
    <h3 class="section-title mb-2">Select a student</h3>
    <div class="user-cards" id="student-cards">
      ${students.map(u => `
        <div class="user-card" data-user-id="${u.id}" id="student-card-${u.id}">
          <div class="user-card-avatar">${u.avatar}</div>
          <div class="user-card-info">
            <div class="user-card-name">${u.displayName}</div>
            <div class="user-card-role">${u.role}</div>
          </div>
        </div>
      `).join('')}
    </div>
    ${students.length === 0 ? '<p style="color:var(--text-muted)">No students registered yet. Create an account for your kids!</p>' : ''}
    <div id="student-detail"></div>
  `;

  document.querySelectorAll('.user-card').forEach(card => {
    card.addEventListener('click', async () => {
      document.querySelectorAll('.user-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const userId = parseInt(card.dataset.userId);
      await renderStudentDetail(document.getElementById('student-detail'), userId, results, lessons);
    });
  });
}

async function renderStudentDetail(container, userId, allResults, lessons) {
  try {
    const statsData = await api('GET', `/api/progress/stats/${userId}`);
    const userResults = allResults.filter(r => r.userId === userId);
    const totalMinutes = Math.round((statsData.totalTimeSec || 0) / 60);

    container.innerHTML = `
      <div class="stats-row mt-3">
        <div class="stat-card">
          <div class="stat-icon">📚</div>
          <div class="stat-value">${statsData.completedLessons}/${statsData.totalLessons}</div>
          <div class="stat-label">Lessons Done</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⭐</div>
          <div class="stat-value">${statsData.averageScore}%</div>
          <div class="stat-label">Avg. Score</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⏱️</div>
          <div class="stat-value">${totalMinutes}m</div>
          <div class="stat-label">Total Time</div>
        </div>
      </div>

      <div class="chart-container">
        <div class="chart-title">📊 Scores Over Time</div>
        <div class="chart-wrapper"><canvas id="scores-chart"></canvas></div>
      </div>

      <div class="chart-container">
        <div class="chart-title">📈 Best Score Per Lesson</div>
        <div class="chart-wrapper"><canvas id="best-scores-chart"></canvas></div>
      </div>

      <div class="card mt-2">
        <h3 class="section-title mb-2">📋 Recent Results</h3>
        ${userResults.length > 0 ? `
          <div style="overflow-x:auto">
            <table class="results-table">
              <thead>
                <tr>
                  <th>Lesson</th>
                  <th>Score</th>
                  <th>Time</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${userResults.slice(0, 20).map(r => {
      const lesson = lessons.find(l => l.id === r.lessonId);
      const scoreClass = r.percentage >= 80 ? 'high' : r.percentage >= 50 ? 'mid' : 'low';
      const mins = Math.floor(r.timeSpentSec / 60);
      const secs = r.timeSpentSec % 60;
      return `
                    <tr>
                      <td><strong>${lesson ? lesson.title : r.lessonId}</strong></td>
                      <td><span class="score-badge ${scoreClass}">${r.percentage}%</span></td>
                      <td>${mins}:${secs.toString().padStart(2, '0')}</td>
                      <td>${new Date(r.completedAt + 'Z').toLocaleDateString()}</td>
                    </tr>
                  `;
    }).join('')}
              </tbody>
            </table>
          </div>
        ` : '<p style="color:var(--text-muted)">No results yet.</p>'}
      </div>
    `;

    // Draw charts
    drawScoresChart(userResults, lessons);
    drawBestScoresChart(statsData.bestScores || [], lessons);
  } catch (err) {
    container.innerHTML = `<p>Error loading stats: ${err.message}</p>`;
  }
}

function drawScoresChart(results, lessons) {
  // Destroy existing chart
  if (state.charts.scores) state.charts.scores.destroy();

  const canvas = document.getElementById('scores-chart');
  if (!canvas || results.length === 0) return;

  const sorted = [...results].reverse(); // chronological
  const labels = sorted.map((r, i) => {
    const lesson = lessons.find(l => l.id === r.lessonId);
    return lesson ? lesson.title.split('—')[0].trim() : `#${i + 1}`;
  });
  const data = sorted.map(r => r.percentage);

  state.charts.scores = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Score %',
        data,
        borderColor: '#6C5CE7',
        backgroundColor: 'rgba(108, 92, 231, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#6C5CE7',
        pointRadius: 5,
        pointHoverRadius: 7,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: v => v + '%' } },
        x: { ticks: { maxRotation: 45 } },
      },
    },
  });
}

function drawBestScoresChart(bestScores, lessons) {
  if (state.charts.bestScores) state.charts.bestScores.destroy();

  const canvas = document.getElementById('best-scores-chart');
  if (!canvas || bestScores.length === 0) return;

  const labels = bestScores.map(b => {
    const lesson = lessons.find(l => l.id === b.lessonId);
    return lesson ? lesson.title.split('—')[0].trim() : b.lessonId;
  });
  const data = bestScores.map(b => b.bestScore);
  const colors = data.map(d => d >= 80 ? '#00B894' : d >= 50 ? '#FDCB6E' : '#FF6B6B');

  state.charts.bestScores = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Best Score %',
        data,
        backgroundColor: colors,
        borderRadius: 8,
        barThickness: 40,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 100, ticks: { callback: v => v + '%' } },
      },
    },
  });
}

// ─── Admin Analytics Tab ───────────────────────────────────
async function renderAdminAnalyticsTab(container) {
  if (state.user.role !== 'admin') {
    container.innerHTML = '<p>Admins only.</p>';
    return;
  }

  try {
    const data = await api('GET', '/api/admin/analytics');
    const totals = data.totals || {};

    container.innerHTML = `
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-icon">👁️</div>
          <div class="stat-value">${totals.totalVisits || 0}</div>
          <div class="stat-label">Total Visits</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📅</div>
          <div class="stat-value">${totals.visitsToday || 0}</div>
          <div class="stat-label">Today</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🧭</div>
          <div class="stat-value">${totals.uniqueVisitors7d || 0}</div>
          <div class="stat-label">Unique IPs (7d)</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🧩</div>
          <div class="stat-value">${totals.apiCalls7d || 0}</div>
          <div class="stat-label">API Calls (7d)</div>
        </div>
      </div>

      <div class="card mb-2">
        <h3 class="section-title mb-2">Top Paths (14 days)</h3>
        <div style="overflow-x:auto">
          <table class="results-table">
            <thead><tr><th>Path</th><th>Visits</th></tr></thead>
            <tbody>
              ${(data.topPaths14d || []).map(r => `<tr><td>${r.path}</td><td>${r.visits}</td></tr>`).join('') || '<tr><td colspan="2">No data yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card mb-2">
        <h3 class="section-title mb-2">Auth Activity (7 days)</h3>
        <div style="overflow-x:auto">
          <table class="results-table">
            <thead><tr><th>Endpoint</th><th>Hits</th></tr></thead>
            <tbody>
              ${(data.authActivity7d || []).map(r => `<tr><td>${r.path}</td><td>${r.count}</td></tr>`).join('') || '<tr><td colspan="2">No data yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3 class="section-title mb-2">Recent Visits</h3>
        <div style="overflow-x:auto">
          <table class="results-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>User</th>
                <th>Role</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              ${(data.recent || []).slice(0, 40).map(r => `
                <tr>
                  <td>${new Date(r.visitedAt + 'Z').toLocaleString()}</td>
                  <td>${r.method}</td>
                  <td>${r.path}</td>
                  <td>${r.statusCode}</td>
                  <td>${r.displayName || 'Guest'}</td>
                  <td>${r.role || 'guest'}</td>
                  <td>${r.ip || ''}</td>
                </tr>
              `).join('') || '<tr><td colspan="7">No data yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p>Error loading analytics: ${err.message}</p>`;
  }
}

// ─── Users Tab ─────────────────────────────────────────────
function renderUsersTab(container, users) {
  const isAdmin = state.user.role === 'admin';
  const myId = state.user.id;

  // Separate users into groups for display
  const myKids = users.filter(u => u.parentId === myId);
  const otherUsers = isAdmin ? users.filter(u => u.parentId !== myId || u.id === myId) : [];

  // Can this user manage (delete/reset) the target?
  function canManage(u) {
    if (u.id === myId) return false; // can't manage yourself
    if (isAdmin) return true; // admins can manage anyone
    return u.parentId === myId; // parents can manage their own kids
  }

  function canResetPassword(u) {
    if (u.id === myId) return false;
    if (isAdmin) return true;
    return u.parentId === myId;
  }

  function renderUserCard(u) {
    const manageable = canManage(u);
    const resetable = canResetPassword(u);
    const ownerLabel = isAdmin && u.parentId
      ? (() => { const p = users.find(x => x.id === u.parentId); return p ? ` · parent: ${escapeHTML(p.displayName)}` : ''; })()
      : '';
    return `
      <div class="user-card" style="cursor:default">
        <div class="user-card-avatar">${u.avatar}</div>
        <div class="user-card-info">
          <div class="user-card-name">${escapeHTML(u.displayName)}</div>
          <div class="user-card-role">${u.role} · @${escapeHTML(u.username)}${ownerLabel}</div>
        </div>
        <div style="display:flex;gap:0.25rem">
          ${resetable ? `<button class="btn btn-ghost" data-reset-user="${u.id}" data-reset-name="${escapeHTML(u.displayName)}" title="Reset Password">🔑</button>` : ''}
          ${manageable ? `<button class="btn btn-ghost" data-delete-user="${u.id}" title="Delete">🗑️</button>` : ''}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="card mb-2">
      <h3 class="section-title mb-2">➕ Add ${isAdmin ? 'User' : 'Child Account'}</h3>
      <form id="add-user-form" style="display:grid; grid-template-columns:${isAdmin ? '1fr 1fr 1fr 1fr auto' : '1fr 1fr 1fr auto'}; gap:0.75rem; align-items:end">
        <div class="form-group" style="margin:0">
          <label class="form-label">Name</label>
          <input class="form-input" id="new-display" placeholder="e.g. Maria" required>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Username</label>
          <input class="form-input" id="new-user" placeholder="e.g. maria" required>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Password</label>
          <input class="form-input" id="new-pass" type="password" placeholder="password" required>
        </div>
        ${isAdmin ? `
        <div class="form-group" style="margin:0">
          <label class="form-label">Role</label>
          <select class="form-input" id="new-role">
            <option value="student">student</option>
            <option value="parent">parent</option>
            <option value="admin">admin</option>
          </select>
        </div>
        ` : ''}
        <button type="submit" class="btn btn-success">Add</button>
      </form>
    </div>

    ${!isAdmin ? `
      <h3 class="section-title mb-2" style="margin-top:1.5rem">👨‍👩‍👧‍👦 My Children</h3>
      <div class="user-cards">
        ${myKids.length > 0 ? myKids.map(u => renderUserCard(u)).join('') : '<p style="color:var(--text-secondary);padding:1rem">No children added yet. Use the form above to create an account for your child.</p>'}
      </div>
    ` : `
      <h3 class="section-title mb-2" style="margin-top:1.5rem">👥 All Users</h3>
      <div class="user-cards">
        ${users.map(u => renderUserCard(u)).join('')}
      </div>
    `}
  `;

  // ── Add user form ──
  document.getElementById('add-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('POST', '/api/auth/register', {
        displayName: document.getElementById('new-display').value.trim(),
        username: document.getElementById('new-user').value.trim(),
        password: document.getElementById('new-pass').value,
        role: isAdmin ? document.getElementById('new-role').value : 'student',
        avatar: '🧒',
      });
      showToast('User added!', 'success');
      navigate('/parent');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // ── Delete user ──
  document.querySelectorAll('[data-delete-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this user and all their progress?')) return;
      try {
        await api('DELETE', `/api/users/${btn.dataset.deleteUser}`);
        showToast('User deleted', 'success');
        navigate('/parent');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  // ── Reset password ──
  document.querySelectorAll('[data-reset-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userName = btn.dataset.resetName;
      const newPassword = prompt(`Enter new password for ${userName}:`);
      if (!newPassword) return;
      if (newPassword.length < 3) {
        showToast('Password must be at least 3 characters', 'error');
        return;
      }
      try {
        await api('POST', `/api/users/${btn.dataset.resetUser}/reset-password`, { newPassword });
        showToast(`Password reset for ${userName}!`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

// ─── Lessons Management Tab ────────────────────────────────
function renderLessonsTab(container, lessons) {
  container.innerHTML = `
    <div class="card mb-2">
      <h3 class="section-title mb-2">📝 Add New Lesson</h3>
      <p style="color:var(--text-secondary);margin-bottom:1rem;font-size:0.9rem">
        Paste a lesson JSON below or load the template to get started. You can also add lessons by placing
        <code>.json</code> files directly in the <code>/lessons</code> folder.
      </p>
      <button class="btn btn-outline mb-2" id="load-template">📋 Load Template</button>
      <textarea class="editor-json" id="lesson-json" placeholder='{"id": "lesson-id", "title": "...", ...}'></textarea>
      <div style="display:flex; gap:0.75rem; margin-top:1rem">
        <button class="btn btn-success" id="save-lesson">💾 Save Lesson</button>
        <button class="btn btn-outline" id="validate-json">✓ Validate JSON</button>
      </div>
    </div>

    <div class="card">
      <h3 class="section-title mb-2">📚 Existing Lessons</h3>
      <div style="overflow-x:auto">
        <table class="results-table">
          <thead>
            <tr>
              <th>Icon</th>
              <th>Title</th>
              <th>Category</th>
              <th>Level</th>
              <th>Words</th>
              <th>Exercises</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${lessons.map(l => `
              <tr>
                <td>${l.icon || '📚'}</td>
                <td><strong>${l.title}</strong></td>
                <td>${l.category}</td>
                <td>${l.level}</td>
                <td>${l.vocabularyCount}</td>
                <td>${l.exerciseCount}</td>
                <td>
                  <button class="btn btn-ghost" data-edit-lesson="${l.id}">✏️</button>
                  <button class="btn btn-ghost" data-delete-lesson="${l.id}">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('load-template').addEventListener('click', async () => {
    try {
      const { template } = await api('GET', '/api/lesson-template');
      document.getElementById('lesson-json').value = JSON.stringify(template, null, 2);
      showToast('Template loaded!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('validate-json').addEventListener('click', () => {
    try {
      const json = JSON.parse(document.getElementById('lesson-json').value);
      if (!json.id || !json.title) throw new Error('Lesson must have "id" and "title"');
      if (!json.exercises || !Array.isArray(json.exercises)) throw new Error('Lesson must have "exercises" array');
      showToast('✅ Valid lesson JSON!', 'success');
    } catch (err) {
      showToast(`Invalid: ${err.message}`, 'error');
    }
  });

  document.getElementById('save-lesson').addEventListener('click', async () => {
    try {
      const lesson = JSON.parse(document.getElementById('lesson-json').value);
      await api('POST', '/api/lessons', lesson);
      showToast('Lesson saved!', 'success');
      navigate('/parent');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.querySelectorAll('[data-edit-lesson]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const { lesson } = await api('GET', `/api/lessons/${btn.dataset.editLesson}`);
        document.getElementById('lesson-json').value = JSON.stringify(lesson, null, 2);
        document.getElementById('lesson-json').scrollIntoView({ behavior: 'smooth' });
        showToast('Lesson loaded for editing', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  document.querySelectorAll('[data-delete-lesson]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this lesson?')) return;
      try {
        await api('DELETE', `/api/lessons/${btn.dataset.deleteLesson}`);
        showToast('Lesson deleted', 'success');
        navigate('/parent');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════
//  CONFETTI 🎉
// ═══════════════════════════════════════════════════════════

function launchConfetti() {
  const container = document.getElementById('confetti-container');
  const colors = ['#6C5CE7', '#FF6B6B', '#00B894', '#FDCB6E', '#FD79A8', '#74B9FF', '#A29BFE', '#FFD700'];

  for (let i = 0; i < 80; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.width = `${Math.random() * 8 + 6}px`;
    confetti.style.height = `${Math.random() * 8 + 6}px`;
    confetti.style.animationDuration = `${Math.random() * 2 + 1.5}s`;
    confetti.style.animationDelay = `${Math.random() * 0.5}s`;
    if (Math.random() > 0.5) confetti.style.borderRadius = '50%';
    container.appendChild(confetti);
  }

  // Clean up after animation
  setTimeout(() => { container.innerHTML = ''; }, 4000);
}

// ═══════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

function showToast(message, type = '') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
