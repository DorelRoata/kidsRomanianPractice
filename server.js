// server.js — Main Express application
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'romanian-kids-practice-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 1 week
}));

// Auth check middleware
function requireAuth(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    next();
}
function requireParent(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    if (req.session.role !== 'parent') return res.status(403).json({ error: 'Parents only' });
    next();
}

// ─── Lesson Loader ─────────────────────────────────────────
const LESSONS_DIR = path.join(__dirname, 'lessons');

function loadLessons() {
    const files = fs.readdirSync(LESSONS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_'));
    const lessons = [];
    for (const file of files) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(LESSONS_DIR, file), 'utf-8'));
            lessons.push(data);
        } catch (err) {
            console.warn(`⚠️  Failed to load lesson ${file}:`, err.message);
        }
    }
    // Sort by order field
    lessons.sort((a, b) => (a.order || 999) - (b.order || 999));
    return lessons;
}

// Cache lessons in memory (reload on admin changes)
let lessonsCache = null;
function getLessons() {
    if (!lessonsCache) lessonsCache = loadLessons();
    return lessonsCache;
}
function reloadLessons() {
    lessonsCache = loadLessons();
}

// ═══════════════════════════════════════════════════════════
//  AUTH ROUTES
// ═══════════════════════════════════════════════════════════

// Register a new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, displayName, password, role = 'student', avatar = '🧒' } = req.body;
        if (!username || !displayName || !password) {
            return res.status(400).json({ error: 'Username, display name, and password are required' });
        }

        // Check if username exists
        const existing = db.get('SELECT id FROM users WHERE username = ?', [username.toLowerCase()]);
        if (existing) return res.status(409).json({ error: 'Username already taken' });

        const hash = await bcrypt.hash(password, 10);
        db.run(
            'INSERT INTO users (username, displayName, password, role, avatar) VALUES (?, ?, ?, ?, ?)',
            [username.toLowerCase(), displayName, hash, role, avatar]
        );
        const id = db.lastInsertId();
        db.save();

        res.json({ success: true, user: { id, username: username.toLowerCase(), displayName, role, avatar } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

        const user = db.get('SELECT * FROM users WHERE username = ?', [username.toLowerCase()]);
        if (!user) return res.status(401).json({ error: 'Invalid username or password' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

        req.session.userId = user.id;
        req.session.role = user.role;

        res.json({
            success: true,
            user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, avatar: user.avatar }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Current user
app.get('/api/auth/me', requireAuth, (req, res) => {
    const user = db.get('SELECT id, username, displayName, role, avatar, createdAt FROM users WHERE id = ?', [req.session.userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
});

// ═══════════════════════════════════════════════════════════
//  USERS ROUTES (parent only)
// ═══════════════════════════════════════════════════════════

app.get('/api/users', requireParent, (req, res) => {
    const users = db.all('SELECT id, username, displayName, role, avatar, createdAt FROM users ORDER BY createdAt');
    res.json({ users });
});

app.delete('/api/users/:id', requireParent, (req, res) => {
    const userId = parseInt(req.params.id);
    if (userId === req.session.userId) return res.status(400).json({ error: 'Cannot delete yourself' });
    db.run('DELETE FROM lesson_results WHERE userId = ?', [userId]);
    db.run('DELETE FROM lesson_progress WHERE userId = ?', [userId]);
    db.run('DELETE FROM users WHERE id = ?', [userId]);
    db.save();
    res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════
//  LESSON ROUTES
// ═══════════════════════════════════════════════════════════

// Get all lessons (metadata only, no exercises)
app.get('/api/lessons', requireAuth, (req, res) => {
    const lessons = getLessons().map(l => ({
        id: l.id,
        title: l.title,
        description: l.description,
        category: l.category,
        level: l.level,
        order: l.order,
        icon: l.icon,
        exerciseCount: l.exercises ? l.exercises.length : 0,
        vocabularyCount: l.vocabulary ? l.vocabulary.length : 0
    }));
    res.json({ lessons });
});

// Get a single lesson with all content
app.get('/api/lessons/:id', requireAuth, (req, res) => {
    const lesson = getLessons().find(l => l.id === req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    res.json({ lesson });
});

// Save a new lesson (parent only — writes JSON file)
app.post('/api/lessons', requireParent, (req, res) => {
    try {
        const lesson = req.body;
        if (!lesson.id || !lesson.title) return res.status(400).json({ error: 'Lesson must have id and title' });

        const filename = `${lesson.id}.json`;
        const filepath = path.join(LESSONS_DIR, filename);

        if (fs.existsSync(filepath)) return res.status(409).json({ error: 'A lesson with this ID already exists' });

        fs.writeFileSync(filepath, JSON.stringify(lesson, null, 2), 'utf-8');
        reloadLessons();
        res.json({ success: true, lesson });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a lesson (parent only)
app.put('/api/lessons/:id', requireParent, (req, res) => {
    try {
        const lesson = req.body;
        const filename = `${req.params.id}.json`;
        const filepath = path.join(LESSONS_DIR, filename);

        if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Lesson not found' });

        fs.writeFileSync(filepath, JSON.stringify(lesson, null, 2), 'utf-8');
        reloadLessons();
        res.json({ success: true, lesson });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a lesson (parent only)
app.delete('/api/lessons/:id', requireParent, (req, res) => {
    try {
        const filename = `${req.params.id}.json`;
        const filepath = path.join(LESSONS_DIR, filename);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        reloadLessons();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════
//  PROGRESS ROUTES
// ═══════════════════════════════════════════════════════════

// Save lesson progress (bookmark current spot)
app.post('/api/progress/save', requireAuth, (req, res) => {
    const { lessonId, currentExercise, answers } = req.body;
    const userId = req.session.userId;

    const existing = db.get('SELECT id FROM lesson_progress WHERE userId = ? AND lessonId = ?', [userId, lessonId]);
    if (existing) {
        db.run(
            `UPDATE lesson_progress SET currentExercise = ?, answers = ?, updatedAt = datetime('now') WHERE userId = ? AND lessonId = ?`,
            [currentExercise, JSON.stringify(answers || []), userId, lessonId]
        );
    } else {
        db.run(
            `INSERT INTO lesson_progress (userId, lessonId, currentExercise, answers) VALUES (?, ?, ?, ?)`,
            [userId, lessonId, currentExercise, JSON.stringify(answers || [])]
        );
    }
    db.save();
    res.json({ success: true });
});

// Get lesson progress (current spot)
app.get('/api/progress/lesson/:lessonId', requireAuth, (req, res) => {
    const progress = db.get(
        'SELECT * FROM lesson_progress WHERE userId = ? AND lessonId = ?',
        [req.session.userId, req.params.lessonId]
    );
    if (progress && progress.answers) {
        progress.answers = JSON.parse(progress.answers);
    }
    res.json({ progress });
});

// Submit lesson result (completed lesson)
app.post('/api/progress/complete', requireAuth, (req, res) => {
    const { lessonId, score, totalQuestions, timeSpentSec } = req.body;
    const userId = req.session.userId;
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

    db.run(
        `INSERT INTO lesson_results (userId, lessonId, score, totalQuestions, percentage, timeSpentSec) VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, lessonId, score, totalQuestions, percentage, timeSpentSec || 0]
    );

    // Clear saved progress for this lesson
    db.run('DELETE FROM lesson_progress WHERE userId = ? AND lessonId = ?', [userId, lessonId]);
    db.save();

    res.json({ success: true, percentage });
});

// Get all results for current user
app.get('/api/progress/my-results', requireAuth, (req, res) => {
    const results = db.all(
        'SELECT * FROM lesson_results WHERE userId = ? ORDER BY completedAt DESC',
        [req.session.userId]
    );
    res.json({ results });
});

// Get all results for all users (parent only)
app.get('/api/progress/all-results', requireParent, (req, res) => {
    const results = db.all(`
    SELECT lr.*, u.displayName, u.avatar
    FROM lesson_results lr
    JOIN users u ON lr.userId = u.id
    ORDER BY lr.completedAt DESC
  `);
    res.json({ results });
});

// Get summary stats for a user
app.get('/api/progress/stats/:userId', requireAuth, (req, res) => {
    const userId = parseInt(req.params.userId);
    // Only allow viewing own stats or parent viewing any
    if (userId !== req.session.userId && req.session.role !== 'parent') {
        return res.status(403).json({ error: 'Access denied' });
    }

    const totalLessons = getLessons().length;
    const completedLessons = db.get(
        'SELECT COUNT(DISTINCT lessonId) as count FROM lesson_results WHERE userId = ?', [userId]
    );
    const avgScore = db.get(
        'SELECT AVG(percentage) as avg FROM lesson_results WHERE userId = ?', [userId]
    );
    const totalTime = db.get(
        'SELECT SUM(timeSpentSec) as total FROM lesson_results WHERE userId = ?', [userId]
    );
    const recentResults = db.all(
        'SELECT * FROM lesson_results WHERE userId = ? ORDER BY completedAt DESC LIMIT 10', [userId]
    );
    const bestScores = db.all(`
    SELECT lessonId, MAX(percentage) as bestScore, COUNT(*) as attempts
    FROM lesson_results WHERE userId = ?
    GROUP BY lessonId
    ORDER BY lessonId
  `, [userId]);

    res.json({
        totalLessons,
        completedLessons: completedLessons ? completedLessons.count : 0,
        averageScore: avgScore && avgScore.avg ? Math.round(avgScore.avg) : 0,
        totalTimeSec: totalTime ? totalTime.total || 0 : 0,
        recentResults,
        bestScores
    });
});

// ═══════════════════════════════════════════════════════════
//  LESSON TEMPLATE ROUTE
// ═══════════════════════════════════════════════════════════

app.get('/api/lesson-template', requireParent, (req, res) => {
    try {
        const templatePath = path.join(LESSONS_DIR, '_template.json');
        const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
        res.json({ template });
    } catch (err) {
        res.status(404).json({ error: 'Template not found' });
    }
});

// ═══════════════════════════════════════════════════════════
//  SPA FALLBACK — serve index.html for all non-API routes
// ═══════════════════════════════════════════════════════════

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ═══════════════════════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════════════════════

async function start() {
    await db.initDatabase();

    // Ensure a default parent account exists
    const parentExists = db.get("SELECT id FROM users WHERE role = 'parent'");
    if (!parentExists) {
        const hash = await bcrypt.hash('parent123', 10);
        db.run(
            "INSERT INTO users (username, displayName, password, role, avatar) VALUES (?, ?, ?, ?, ?)",
            ['parent', 'Mom & Dad', hash, 'parent', '👨‍👩‍👧‍👦']
        );
        db.save();
        console.log('👨‍👩‍👧‍👦 Default parent account created — username: parent / password: parent123');
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log('');
        console.log('🇷🇴  Kids Romanian Practice is running!');
        console.log(`   Local:   http://localhost:${PORT}`);
        console.log(`   Network: http://<your-ip>:${PORT}`);
        console.log('');
        console.log('   Parent login — username: parent / password: parent123');
        console.log('');
    });
}

start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
