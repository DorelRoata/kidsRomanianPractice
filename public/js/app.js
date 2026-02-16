/* ═══════════════════════════════════════════════════════════
   Kids Romanian Practice — Single Page Application
   ═══════════════════════════════════════════════════════════ */

// ─── State ────────────────────────────────────────────────
const state = {
  user: null,
  lessons: [],
  currentLesson: null,
  currentPhase: 'vocab', // 'vocab' | 'exercise'
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
  selectedAvatar: '🧒',
  charts: {},
};

const AVATARS = ['🧒', '👦', '👧', '🧒🏻', '👦🏻', '👧🏻', '🧒🏽', '👦🏽', '👧🏽', '🧒🏿', '👦🏿', '👧🏿', '🦸', '🧙', '🦊', '🐱', '🐶', '🦁', '🐼', '🦄', '🐸', '🐵'];
let cachedRomanianVoice = null;
const GUEST_USER = { id: null, username: 'guest', displayName: 'Guest', role: 'guest', avatar: '🧒' };

// ─── API Helper ───────────────────────────────────────────
async function api(method, url, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── Speech Helper (Pre-K listen lessons) ────────────────
function pickRomanianVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;
  return voices.find(v => /^ro(-|_)/i.test(v.lang)) || null;
}

function speakRomanian(text, { rate = 0.82, pitch = 1 } = {}) {
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

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedRomanianVoice = pickRomanianVoice();
  };
}

function isGuestUser() {
  return state.user && state.user.role === 'guest';
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

// ─── Router ───────────────────────────────────────────────
function navigate(hash) {
  window.location.hash = hash;
}

function getRoute() {
  return window.location.hash.slice(1) || '/';
}

window.addEventListener('hashchange', () => router());

async function router() {
  const route = getRoute();
  const app = document.getElementById('app');

  // Not logged in — show auth page
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
  } catch {
    state.user = null;
  }
  router();
}

document.addEventListener('DOMContentLoaded', init);

// ═══════════════════════════════════════════════════════════
//  AUTH VIEWS
// ═══════════════════════════════════════════════════════════

function renderLogin(container) {
  container.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-flag">🇷🇴</div>
        <h1 class="auth-title">Învață Română!</h1>
        <p class="auth-subtitle">Sign in to start practicing</p>
        <div id="auth-error" class="auth-error"></div>
        <form id="login-form">
          <div class="form-group">
            <label class="form-label" for="login-user">Username</label>
            <input class="form-input" type="text" id="login-user" placeholder="Enter your username" autocomplete="username" autocapitalize="off" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="login-pass">Password</label>
            <input class="form-input" type="password" id="login-pass" placeholder="Enter your password" autocomplete="current-password" required>
          </div>
          <button type="submit" class="btn btn-primary btn-lg btn-block" id="login-btn">🔑 Sign In</button>
        </form>
        <button class="btn btn-outline btn-lg btn-block" id="guest-continue">👶 Continue as Guest</button>
        <p class="auth-switch">Don't have an account? <a id="go-register">Create one</a></p>
      </div>
    </div>
  `;

  document.getElementById('go-register').addEventListener('click', () => navigate('/register'));
  document.getElementById('guest-continue').addEventListener('click', () => {
    state.user = { ...GUEST_USER };
    navigate('/');
  });
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('auth-error');
    errEl.classList.remove('visible');
    try {
      const data = await api('POST', '/api/auth/login', {
        username: document.getElementById('login-user').value.trim(),
        password: document.getElementById('login-pass').value,
      });
      state.user = data.user;
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
      ? `<div class="card mb-2"><strong>Guest mode:</strong> lessons work normally, but progress and stats are not saved.</div>`
      : '';

    container.innerHTML = `
      ${renderNavbar()}
      <div class="dashboard">
        <div class="hero">
          <h1>Bună, ${state.user.displayName}! 👋</h1>
          <p>${isGuestUser() ? 'Pick any lesson and start right away.' : 'Ready to learn some Romanian today?'}</p>
        </div>

        ${guestNotice}

        ${!isGuestUser() ? `
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-icon">📚</div>
            <div class="stat-value">${stats.completedLessons}/${stats.totalLessons}</div>
            <div class="stat-label">Lessons Done</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⭐</div>
            <div class="stat-value">${stats.averageScore}%</div>
            <div class="stat-label">Avg. Score</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⏱️</div>
            <div class="stat-value">${totalMinutes}</div>
            <div class="stat-label">Minutes</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🔥</div>
            <div class="stat-value">${stats.recentResults ? stats.recentResults.length : 0}</div>
            <div class="stat-label">Attempts</div>
          </div>
        </div>
        ` : ''}

        <div class="section-header">
          <h2 class="section-title">📖 Lessons</h2>
        </div>
        <div class="lessons-grid">
          ${state.lessons.map(l => {
      const best = bestScoresMap[l.id];
      const pct = best ? best.bestScore : 0;
      const isCompleted = pct >= 80;
      return `
              <div class="lesson-card${isCompleted ? ' completed' : ''}" data-lesson="${l.id}" id="lesson-${l.id}">
                <div class="lesson-card-icon">${l.icon || '📚'}</div>
                <div class="lesson-card-title">${l.title}</div>
                <div class="lesson-card-desc">${l.description}</div>
                <div class="lesson-card-meta">
                  <span class="lesson-card-badge badge-category">${l.category}</span>
                  <span class="lesson-card-badge badge-level">Level ${l.level}</span>
                  <span>${l.vocabularyCount} words · ${l.exerciseCount} exercises</span>
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
      </div>
    `;

    document.querySelectorAll('.lesson-card').forEach(card => {
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
  const hasDashboard = ['parent', 'admin'].includes(state.user.role);
  const authButton = isGuestUser()
    ? '<button class="btn btn-ghost" id="nav-signin" title="Sign in">🔐 Sign In</button>'
    : '<button class="btn btn-ghost" id="nav-logout" title="Sign out">🚪</button>';

  return `
    <nav class="navbar">
      <a class="navbar-brand" id="nav-home">
        <span class="flag">🇷🇴</span>
        <span>Învață Română</span>
      </a>
      <div class="navbar-user">
        ${hasDashboard ? '<button class="btn btn-ghost" id="nav-parent">📊 Dashboard</button>' : ''}
        <div class="navbar-avatar">${state.user.avatar || '🧒'}</div>
        <span class="navbar-name">${state.user.displayName}</span>
        ${authButton}
      </div>
    </nav>
  `;
}

function setupNavbar() {
  document.getElementById('nav-home')?.addEventListener('click', () => navigate('/'));
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
  const vocab = lesson.vocabulary;
  if (!vocab || vocab.length === 0) {
    state.currentPhase = 'exercise';
    return renderExercise();
  }

  const v = vocab[state.vocabIndex];
  const hasExample = v.example && v.example.romanian;

  // Decide what to show as the "Image" (File path or Emoji fallback)
  const imageHtml = v.image
    ? `<img src="${v.image}" class="vocab-image" alt="${v.english}">`
    : `<div class="vocab-emoji">${v.emoji || state.currentLesson.icon || '📚'}</div>`;

  return `
    <div class="vocab-phase-title">📖 Learn New Words</div>
    <div class="vocab-phase-subtitle">Tap the card to see the translation</div>
    <div class="vocab-card" id="vocab-card">
      <div class="vocab-front">
        ${imageHtml}
        <div class="vocab-word">${v.romanian}</div>
        ${v.pronunciation ? `<div class="vocab-pronunciation">[ ${v.pronunciation} ]</div>` : ''}
        <div class="vocab-hint">Tap to reveal meaning</div>
      </div>
      <div class="vocab-back">
        ${imageHtml}
        <div class="vocab-word">${v.romanian}</div>
        ${v.pronunciation ? `<div class="vocab-pronunciation">[ ${v.pronunciation} ]</div>` : ''}
        <div class="vocab-translation">= ${v.english}</div>
        ${hasExample ? `
          <div class="vocab-example">
            <div class="vocab-example-ro">"${v.example.romanian}"</div>
            <div class="vocab-example-en">${v.example.english}</div>
          </div>
        ` : ''}
      </div>
    </div>
    <div class="vocab-counter">${state.vocabIndex + 1} of ${vocab.length} words</div>
    <div class="vocab-nav">
      ${state.vocabIndex > 0 ? `<button class="btn btn-outline" id="vocab-prev">← Previous</button>` : '<span></span>'}
      <button class="btn btn-primary" id="vocab-next">
        ${state.vocabIndex < vocab.length - 1 ? 'Next Word →' : 'Start Exercises! 🎯'}
      </button>
    </div>
  `;
}

function setupVocabInteraction() {
  const card = document.getElementById('vocab-card');
  if (!card) return;

  card.addEventListener('click', () => {
    card.classList.toggle('flipped');
  });

  document.getElementById('vocab-prev')?.addEventListener('click', () => {
    state.vocabIndex--;
    updateLessonContent();
  });

  document.getElementById('vocab-next')?.addEventListener('click', () => {
    const vocab = state.currentLesson.vocabulary;
    if (state.vocabIndex < vocab.length - 1) {
      state.vocabIndex++;
      updateLessonContent();
    } else {
      // Move to exercises
      state.currentPhase = 'exercise';
      state.exerciseIndex = 0;
      if (!state.exerciseQueue || state.exerciseQueue.length === 0) {
        const totalExercises = (state.currentLesson.exercises || []).length;
        state.exerciseQueue = Array.from({ length: totalExercises }, (_, i) => i);
      }
      renderLesson(document.getElementById('app'));
    }
  });
}

// ─── Exercises ─────────────────────────────────────────────
function getCurrentExerciseId() {
  if (!state.exerciseQueue || state.exerciseQueue.length === 0) return -1;
  return state.exerciseQueue[state.exerciseIndex];
}

function getCurrentExercise() {
  const exercises = state.currentLesson.exercises || [];
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

function recordAttempt(exerciseId, isCorrect) {
  const key = String(exerciseId);
  const wasMastered = !!state.masteredExercises[key];
  state.answers.push(!!isCorrect);

  if (isCorrect) {
    if (!wasMastered) {
      state.masteredExercises[key] = true;
      state.score++;
    }
    return;
  }

  if (!wasMastered) queueAdaptiveRetry(exerciseId);
}

function renderExercise() {
  if (state.exerciseIndex >= state.exerciseQueue.length) {
    return ''; // Will be handled by completion
  }

  const ex = getCurrentExercise();
  if (!ex) return '<p>Exercise not found.</p>';

  switch (ex.type) {
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
      return `<p>Unknown exercise type: ${ex.type}</p>`;
  }
}

function renderMultipleChoice(ex) {
  const qLabel = ex.type === 'multiple_choice_romanian'
    ? `🇷🇴 ${ex.question}`
    : `🇬🇧 ${ex.question}`;

  return `
    <div class="exercise-question">${qLabel}</div>
    <div class="mc-options">
      ${ex.options.map((opt, i) => `
        <button class="mc-option" data-index="${i}" id="mc-opt-${i}">${opt}</button>
      `).join('')}
    </div>
    <div class="exercise-continue hidden" id="ex-continue">
      <button class="btn btn-primary btn-lg" id="continue-btn">Continue →</button>
    </div>
  `;
}

function renderMatch(ex) {
  // Shuffle both columns independently
  const pairs = ex.pairs;
  const leftItems = [...pairs].sort(() => Math.random() - 0.5);
  const rightItems = [...pairs].sort(() => Math.random() - 0.5);

  return `
    <div class="exercise-question">${ex.instruction || 'Match the pairs!'}</div>
    <div class="match-container">
      <div>
        <div class="match-column-label">🇷🇴 Romanian</div>
        <div class="match-column" id="match-left">
          ${leftItems.map((p, i) => `<div class="match-item" data-side="left" data-value="${p.romanian}" data-pair="${pairs.indexOf(p)}" id="match-left-${i}">${p.romanian}</div>`).join('')}
        </div>
      </div>
      <div>
        <div class="match-column-label">🇬🇧 English</div>
        <div class="match-column" id="match-right">
          ${rightItems.map((p, i) => `<div class="match-item" data-side="right" data-value="${p.english}" data-pair="${pairs.indexOf(p)}" id="match-right-${i}">${p.english}</div>`).join('')}
        </div>
      </div>
    </div>
    <div class="exercise-continue hidden" id="ex-continue">
      <button class="btn btn-primary btn-lg" id="continue-btn">Continue →</button>
    </div>
  `;
}

function renderSelectImage(ex) {
  return `
    <div class="exercise-question">🖼️ ${ex.question}</div>
    <div class="image-options">
      ${ex.options.map((opt, i) => `
        <div class="image-option" data-index="${i}" id="img-opt-${i}">
          ${opt.image ? `<img src="${opt.image}" alt="${opt.text}">` : `<div class="img-emoji">${opt.emoji || '❓'}</div>`}
          <div class="image-label">${opt.text}</div>
        </div>
      `).join('')}
    </div>
    <div class="exercise-continue hidden" id="ex-continue">
      <button class="btn btn-primary btn-lg" id="continue-btn">Continue →</button>
    </div>
  `;
}

function renderListenAndSelect(ex) {
  const promptText = ex.prompt || '';
  const hideLabels = ex.hideLabels !== false;
  return `
    <div class="exercise-question">👂 Listen and choose the right one</div>
    <div class="listen-prompt-card">
      <button class="listen-play-btn" id="listen-play-btn" type="button">🔊 Play Word</button>
      <div class="listen-instruction">${ex.instruction || 'Tap Play, then pick the matching picture or action.'}</div>
      ${ex.showPromptText ? `<div class="listen-prompt-text">${promptText}</div>` : ''}
    </div>
    <div class="image-options pre-k-options${hideLabels ? ' no-labels' : ''}">
      ${ex.options.map((opt, i) => `
        <div class="image-option" data-index="${i}" id="img-opt-${i}" aria-label="${opt.text || `option ${i + 1}`}">
          ${opt.image ? `<img src="${opt.image}" alt="${opt.text || `Option ${i + 1}`}">` : `<div class="img-emoji">${opt.emoji || '❓'}</div>`}
          <div class="image-label">${opt.text || ''}</div>
        </div>
      `).join('')}
    </div>
    <div class="exercise-continue hidden" id="ex-continue">
      <button class="btn btn-primary btn-lg" id="continue-btn">Continue →</button>
    </div>
  `;
}

function renderTypeAnswer(ex) {
  const question = ex.type === 'translate'
    ? `📝 ${ex.instruction || 'Translate:'}<br><strong style="font-size:1.5rem;color:var(--primary)">${ex.sentence}</strong>`
    : `✍️ ${ex.question}`;

  return `
    <div class="exercise-question">${question}</div>
    <input type="text" class="type-answer-input" id="type-input" placeholder="Type your answer..." autocomplete="off" autocapitalize="off" spellcheck="false">
    <div class="type-answer-submit text-center">
      <button class="btn btn-primary btn-lg" id="type-submit">Check Answer ✓</button>
    </div>
    <div class="type-answer-feedback hidden" id="type-feedback"></div>
    <div class="exercise-continue hidden" id="ex-continue">
      <button class="btn btn-primary btn-lg" id="continue-btn">Continue →</button>
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

  switch (ex.type) {
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

      // Disable all options
      options.forEach(o => o.classList.add('disabled'));

      if (correct) {
        opt.classList.add('correct');
      } else {
        opt.classList.add('incorrect');
        // Show correct answer
        options[ex.correctAnswer].classList.add('show-correct');
      }
      recordAttempt(exerciseId, correct);

      // Show continue button
      setTimeout(() => {
        document.getElementById('ex-continue').classList.remove('hidden');
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
  const totalPairs = ex.pairs.length;
  let matchErrors = 0;

  document.querySelectorAll('.match-item').forEach(item => {
    item.addEventListener('click', () => {
      if (item.classList.contains('matched')) return;

      const side = item.dataset.side;

      if (side === 'left') {
        // Deselect previous left selection
        if (selectedLeft) selectedLeft.classList.remove('selected');
        selectedLeft = item;
        item.classList.add('selected');
      } else {
        // Deselect previous right selection
        if (selectedRight) selectedRight.classList.remove('selected');
        selectedRight = item;
        item.classList.add('selected');
      }

      // Check if both sides selected
      if (selectedLeft && selectedRight) {
        const leftPair = parseInt(selectedLeft.dataset.pair);
        const rightPair = parseInt(selectedRight.dataset.pair);

        if (leftPair === rightPair) {
          // Correct match!
          selectedLeft.classList.remove('selected');
          selectedRight.classList.remove('selected');
          selectedLeft.classList.add('matched');
          selectedRight.classList.add('matched');
          matchedCount++;

          selectedLeft = null;
          selectedRight = null;

          if (matchedCount === totalPairs) {
            // All matched — count as correct if few errors
            const correct = matchErrors < totalPairs;
            recordAttempt(exerciseId, correct);
            setTimeout(() => {
              document.getElementById('ex-continue').classList.remove('hidden');
              setupContinueButton();
            }, 400);
          }
        } else {
          // Wrong match
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

      // Disable interactions
      options.forEach(o => o.style.pointerEvents = 'none');

      if (correct) {
        opt.classList.add('correct');
        launchConfetti(); // Little burst for correct image pick
      } else {
        opt.classList.add('incorrect');
        // Highlight correct one
        const correctOpt = document.getElementById(`img-opt-${ex.correctAnswer}`);
        if (correctOpt) correctOpt.classList.add('show-correct');
      }
      recordAttempt(exerciseId, correct);

      setTimeout(() => {
        document.getElementById('ex-continue').classList.remove('hidden');
        setupContinueButton();
      }, 500);
    });
  });
}

function setupListenAndSelect(ex) {
  setupSelectImage(ex);
  const promptText = ex.prompt || '';
  const playBtn = document.getElementById('listen-play-btn');

  const playPrompt = () => {
    const played = speakRomanian(promptText, {
      rate: typeof ex.speechRate === 'number' ? ex.speechRate : 0.82,
      pitch: typeof ex.speechPitch === 'number' ? ex.speechPitch : 1
    });
    if (!played) {
      showToast('Audio is not available in this browser.', 'error');
    }
  };

  playBtn?.addEventListener('click', playPrompt);

  if (ex.autoPlay) {
    setTimeout(playPrompt, 250);
  }
}

function setupTypeAnswer(ex) {
  const input = document.getElementById('type-input');
  const submitBtn = document.getElementById('type-submit');
  const feedback = document.getElementById('type-feedback');
  const exerciseId = getCurrentExerciseId();
  let answered = false;

  function checkAnswer() {
    if (answered) return;
    answered = true;

    const userAnswer = input.value.trim();
    const correctAnswer = ex.answer || ex.sentence;
    const alternatives = ex.acceptAlternatives || [];
    const allAccepted = [correctAnswer, ...alternatives].map(a => a.toLowerCase().trim());

    const isCorrect = allAccepted.includes(userAnswer.toLowerCase().trim());

    input.disabled = true;
    submitBtn.style.display = 'none';
    feedback.classList.remove('hidden');

    if (isCorrect) {
      input.classList.add('correct');
      feedback.className = 'type-answer-feedback correct';
      feedback.textContent = '✅ Correct! Great job!';
    } else {
      input.classList.add('incorrect');
      feedback.className = 'type-answer-feedback incorrect';
      feedback.innerHTML = `❌ The correct answer is: <strong>${correctAnswer}</strong>`;
    }
    recordAttempt(exerciseId, isCorrect);

    setTimeout(() => {
      document.getElementById('ex-continue').classList.remove('hidden');
      setupContinueButton();
    }, 400);
  }

  submitBtn.addEventListener('click', checkAnswer);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkAnswer();
  });

  // Focus input
  setTimeout(() => input.focus(), 100);
}

function setupContinueButton() {
  document.getElementById('continue-btn')?.addEventListener('click', () => {
    state.exerciseIndex++;

    if (state.exerciseIndex >= state.exerciseQueue.length) {
      completeLesson();
    } else {
      // Save progress
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

  // Update progress bar
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

  // Update counter
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

// ─── Lesson Completion ─────────────────────────────────────
async function completeLesson() {
  const lesson = state.currentLesson;
  const total = lesson.exercises ? lesson.exercises.length : 0;
  const percentage = total > 0 ? Math.round((state.score / total) * 100) : 100;
  const timeSpent = Math.round((Date.now() - state.lessonStartTime) / 1000);
  const nextLessonId = getNextLessonId(lesson.id);
  clearAutoProgressTimer();

  // Send results to server
  if (canPersistProgress()) {
    try {
      await api('POST', '/api/progress/complete', {
        lessonId: lesson.id,
        score: state.score,
        totalQuestions: total,
        timeSpentSec: timeSpent,
      });
    } catch (err) {
      console.error('Failed to save results:', err);
    }
  }

  // Determine result tier
  let icon, title, subtitle, color;
  if (percentage >= 90) {
    icon = '🏆'; title = 'Excelent!'; subtitle = 'Outstanding work!'; color = '#FFD700';
    launchConfetti();
  } else if (percentage >= 70) {
    icon = '⭐'; title = 'Bine!'; subtitle = 'Good job!'; color = 'var(--accent-teal)';
    launchConfetti();
  } else if (percentage >= 50) {
    icon = '👍'; title = 'OK!'; subtitle = 'Keep practicing!'; color = 'var(--accent-orange)';
  } else {
    icon = '💪'; title = 'Try Again!'; subtitle = "Practice makes perfect!"; color = 'var(--accent-coral)';
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
            <div class="results-stat-label">Correct</div>
          </div>
          <div class="results-stat-item">
            <div class="results-stat-value">${minutes}:${seconds.toString().padStart(2, '0')}</div>
            <div class="results-stat-label">Time</div>
          </div>
        </div>
        ${isGuestUser() ? `<div class="vocab-hint">Guest mode: progress is not saved.</div>` : ''}
        ${(nextLessonId && percentage >= 80) ? `<div class="vocab-hint">Auto progression in 4 seconds...</div>` : ''}

        <div class="results-actions">
          <button class="btn btn-primary btn-lg btn-block" id="results-retry">🔄 Try Again</button>
          ${nextLessonId ? `<button class="btn btn-success btn-lg btn-block" id="results-next">➡️ Next Lesson</button>` : ''}
          <button class="btn btn-outline btn-lg btn-block" id="results-home">🏠 Back to Lessons</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('results-retry').addEventListener('click', () => {
    clearAutoProgressTimer();
    navigate(`/lesson/${lesson.id}`);
  });
  document.getElementById('results-next')?.addEventListener('click', () => {
    clearAutoProgressTimer();
    navigate(`/lesson/${nextLessonId}`);
  });
  document.getElementById('results-home').addEventListener('click', () => {
    clearAutoProgressTimer();
    navigate('/');
  });

  if (nextLessonId && percentage >= 80) {
    state.autoProgressTimer = setTimeout(() => {
      navigate(`/lesson/${nextLessonId}`);
    }, 4000);
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
  container.innerHTML = `
    <div class="card mb-2">
      <h3 class="section-title mb-2">➕ Add ${isAdmin ? 'User' : 'Student Account'}</h3>
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

    <div class="user-cards">
      ${users.map(u => `
        <div class="user-card" style="cursor:default">
          <div class="user-card-avatar">${u.avatar}</div>
          <div class="user-card-info">
            <div class="user-card-name">${u.displayName}</div>
            <div class="user-card-role">${u.role} · @${u.username}</div>
          </div>
          ${((isAdmin && u.id !== state.user.id) || (!isAdmin && u.role === 'student')) ? `<button class="btn btn-ghost" data-delete-user="${u.id}" title="Delete">🗑️</button>` : ''}
        </div>
      `).join('')}
    </div>
  `;

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
      // Refresh
      navigate('/parent');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

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
