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
    exerciseIndex: 0,
    answers: [],
    score: 0,
    lessonStartTime: null,
    selectedAvatar: '🧒',
    charts: {},
};

const AVATARS = ['🧒', '👦', '👧', '🧒🏻', '👦🏻', '👧🏻', '🧒🏽', '👦🏽', '👧🏽', '🧒🏿', '👦🏿', '👧🏿', '🦸', '🧙', '🦊', '🐱', '🐶', '🦁', '🐼', '🦄', '🐸', '🐵'];

// ─── API Helper ───────────────────────────────────────────
async function api(method, url, body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
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
        <p class="auth-switch">Don't have an account? <a id="go-register">Create one</a></p>
      </div>
    </div>
  `;

    document.getElementById('go-register').addEventListener('click', () => navigate('/register'));
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
    // Load lessons & stats
    try {
        const [lessonData, statsData] = await Promise.all([
            api('GET', '/api/lessons'),
            api('GET', `/api/progress/stats/${state.user.id}`),
        ]);
        state.lessons = lessonData.lessons;

        const stats = statsData;
        const totalMinutes = Math.round((stats.totalTimeSec || 0) / 60);
        const bestScoresMap = {};
        (stats.bestScores || []).forEach(b => { bestScoresMap[b.lessonId] = b; });

        container.innerHTML = `
      ${renderNavbar()}
      <div class="dashboard">
        <div class="hero">
          <h1>Bună, ${state.user.displayName}! 👋</h1>
          <p>Ready to learn some Romanian today?</p>
        </div>

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

        // Lesson card clicks
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
    return `
    <nav class="navbar">
      <a class="navbar-brand" id="nav-home">
        <span class="flag">🇷🇴</span>
        <span>Învață Română</span>
      </a>
      <div class="navbar-user">
        ${state.user.role === 'parent' ? '<button class="btn btn-ghost" id="nav-parent">📊 Dashboard</button>' : ''}
        <div class="navbar-avatar">${state.user.avatar || '🧒'}</div>
        <span class="navbar-name">${state.user.displayName}</span>
        <button class="btn btn-ghost" id="nav-logout" title="Sign out">🚪</button>
      </div>
    </nav>
  `;
}

function setupNavbar() {
    document.getElementById('nav-home')?.addEventListener('click', () => navigate('/'));
    document.getElementById('nav-logout')?.addEventListener('click', async () => {
        await api('POST', '/api/auth/logout');
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
        const { lesson } = await api('GET', `/api/lessons/${lessonId}`);
        state.currentLesson = lesson;
        state.currentPhase = 'vocab';
        state.vocabIndex = 0;
        state.exerciseIndex = 0;
        state.answers = [];
        state.score = 0;
        state.lessonStartTime = Date.now();

        // Check for saved progress
        try {
            const { progress } = await api('GET', `/api/progress/lesson/${lessonId}`);
            if (progress && progress.currentExercise > 0) {
                state.currentPhase = 'exercise';
                state.exerciseIndex = progress.currentExercise;
                state.answers = progress.answers || [];
                state.score = state.answers.filter(a => a === true).length;
            }
        } catch { }

        renderLesson(container);
    } catch (err) {
        container.innerHTML = `<div class="flex-center" style="min-height:100vh"><p>Error: ${err.message}</p></div>`;
    }
}

function renderLesson(container) {
    const lesson = state.currentLesson;
    const totalSteps = (lesson.vocabulary ? lesson.vocabulary.length : 0) + (lesson.exercises ? lesson.exercises.length : 0);
    let currentStep;
    if (state.currentPhase === 'vocab') {
        currentStep = state.vocabIndex;
    } else {
        currentStep = (lesson.vocabulary ? lesson.vocabulary.length : 0) + state.exerciseIndex;
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
        if (state.currentPhase === 'exercise' && state.exerciseIndex > 0) {
            api('POST', '/api/progress/save', {
                lessonId: lesson.id,
                currentExercise: state.exerciseIndex,
                answers: state.answers,
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

    return `
    <div class="vocab-phase-title">📖 Learn New Words</div>
    <div class="vocab-phase-subtitle">Tap the card to see the translation</div>
    <div class="vocab-card" id="vocab-card">
      <div class="vocab-front">
        <div class="vocab-word">${v.romanian}</div>
        ${v.pronunciation ? `<div class="vocab-pronunciation">[ ${v.pronunciation} ]</div>` : ''}
        <div class="vocab-hint">Tap to reveal meaning</div>
      </div>
      <div class="vocab-back">
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
            renderLesson(document.getElementById('app'));
        }
    });
}

// ─── Exercises ─────────────────────────────────────────────
function renderExercise() {
    const lesson = state.currentLesson;
    const exercises = lesson.exercises || [];
    if (state.exerciseIndex >= exercises.length) {
        return ''; // Will be handled by completion
    }

    const ex = exercises[state.exerciseIndex];

    switch (ex.type) {
        case 'multiple_choice':
        case 'multiple_choice_romanian':
            return renderMultipleChoice(ex);
        case 'match':
            return renderMatch(ex);
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
    const lesson = state.currentLesson;
    const exercises = lesson.exercises || [];
    if (state.exerciseIndex >= exercises.length) {
        completeLesson();
        return;
    }

    const ex = exercises[state.exerciseIndex];

    switch (ex.type) {
        case 'multiple_choice':
        case 'multiple_choice_romanian':
            setupMultipleChoice(ex);
            break;
        case 'match':
            setupMatch(ex);
            break;
        case 'type_answer':
        case 'translate':
            setupTypeAnswer(ex);
            break;
    }
}

function setupMultipleChoice(ex) {
    const options = document.querySelectorAll('.mc-option');
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
                state.score++;
                state.answers.push(true);
            } else {
                opt.classList.add('incorrect');
                state.answers.push(false);
                // Show correct answer
                options[ex.correctAnswer].classList.add('show-correct');
            }

            // Show continue button
            setTimeout(() => {
                document.getElementById('ex-continue').classList.remove('hidden');
                setupContinueButton();
            }, 600);
        });
    });
}

function setupMatch(ex) {
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
                        state.answers.push(matchErrors < totalPairs);
                        if (matchErrors < totalPairs) state.score++;
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

function setupTypeAnswer(ex) {
    const input = document.getElementById('type-input');
    const submitBtn = document.getElementById('type-submit');
    const feedback = document.getElementById('type-feedback');
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
            state.score++;
            state.answers.push(true);
        } else {
            input.classList.add('incorrect');
            feedback.className = 'type-answer-feedback incorrect';
            feedback.innerHTML = `❌ The correct answer is: <strong>${correctAnswer}</strong>`;
            state.answers.push(false);
        }

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
        const exercises = state.currentLesson.exercises || [];

        if (state.exerciseIndex >= exercises.length) {
            completeLesson();
        } else {
            // Save progress
            api('POST', '/api/progress/save', {
                lessonId: state.currentLesson.id,
                currentExercise: state.exerciseIndex,
                answers: state.answers,
            });
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
    const totalSteps = (lesson.vocabulary ? lesson.vocabulary.length : 0) + (lesson.exercises ? lesson.exercises.length : 0);
    let currentStep = state.currentPhase === 'vocab' ? state.vocabIndex :
        (lesson.vocabulary ? lesson.vocabulary.length : 0) + state.exerciseIndex;
    const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
    const fill = document.querySelector('.lesson-progress-fill');
    if (fill) fill.style.width = `${progress}%`;

    // Update counter
    const counter = document.querySelector('.lesson-header-progress');
    if (counter) counter.textContent = `${currentStep + 1} / ${totalSteps}`;
}

// ─── Lesson Completion ─────────────────────────────────────
async function completeLesson() {
    const lesson = state.currentLesson;
    const total = lesson.exercises ? lesson.exercises.length : 0;
    const percentage = total > 0 ? Math.round((state.score / total) * 100) : 100;
    const timeSpent = Math.round((Date.now() - state.lessonStartTime) / 1000);

    // Send results to server
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

        <div class="results-actions">
          <button class="btn btn-primary btn-lg btn-block" id="results-retry">🔄 Try Again</button>
          <button class="btn btn-outline btn-lg btn-block" id="results-home">🏠 Back to Lessons</button>
        </div>
      </div>
    </div>
  `;

    document.getElementById('results-retry').addEventListener('click', () => {
        navigate(`/lesson/${lesson.id}`);
    });
    document.getElementById('results-home').addEventListener('click', () => {
        navigate('/');
    });
}

// ═══════════════════════════════════════════════════════════
//  PARENT DASHBOARD
// ═══════════════════════════════════════════════════════════

async function renderParentDashboard(container) {
    if (state.user.role !== 'parent') {
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

        container.innerHTML = `
      ${renderNavbar()}
      <div class="parent-dash">
        <div class="hero">
          <h1>📊 Parent Dashboard</h1>
          <p>Track your children's progress and manage lessons</p>
        </div>

        <div class="parent-tabs">
          <button class="parent-tab active" data-tab="progress">📈 Progress</button>
          <button class="parent-tab" data-tab="users">👥 Users</button>
          <button class="parent-tab" data-tab="lessons-manage">📚 Manage Lessons</button>
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
                renderTab(activeTab);
            });
        });

        function renderTab(tab) {
            const content = document.getElementById('tab-content');
            switch (tab) {
                case 'progress': renderProgressTab(content, users, results, lessons); break;
                case 'users': renderUsersTab(content, users); break;
                case 'lessons-manage': renderLessonsTab(content, lessons); break;
            }
        }

        renderTab(activeTab);
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

// ─── Users Tab ─────────────────────────────────────────────
function renderUsersTab(container, users) {
    container.innerHTML = `
    <div class="card mb-2">
      <h3 class="section-title mb-2">➕ Add Student Account</h3>
      <form id="add-user-form" style="display:grid; grid-template-columns:1fr 1fr 1fr auto; gap:0.75rem; align-items:end">
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
          ${u.role !== 'parent' ? `<button class="btn btn-ghost" data-delete-user="${u.id}" title="Delete">🗑️</button>` : ''}
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
                role: 'student',
                avatar: '🧒',
            });
            showToast('Student added!', 'success');
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
