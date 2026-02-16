// server.js — Main Express application
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'romanian-kids-practice-secret-2026';
const LESSON_ID_RE = /^[a-z0-9][a-z0-9-_]*$/i;

// ─── Middleware ────────────────────────────────────────────
app.use(express.json());
app.use(session({
    secret: SESSION_SECRET,
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
    if (!['parent', 'admin'].includes(req.session.role)) return res.status(403).json({ error: 'Parents/Admin only' });
    next();
}
function requireAdmin(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    next();
}

// ─── Lesson Loader ─────────────────────────────────────────
const LESSONS_DIR = path.join(__dirname, 'lessons');
function isSafeLessonId(id) {
    return LESSON_ID_RE.test(String(id || ''));
}
function lessonFilePathFromId(id) {
    if (!isSafeLessonId(id)) return null;
    return path.join(LESSONS_DIR, `${id}.json`);
}

function shouldTrackVisit(reqPath) {
    if (!reqPath) return false;
    if (reqPath === '/favicon.ico') return false;
    if (reqPath.startsWith('/css/') || reqPath.startsWith('/js/') || reqPath.startsWith('/icons/')) return false;
    if (/\.(css|js|map|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf)$/i.test(reqPath)) return false;
    return true;
}

app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
        if (!shouldTrackVisit(req.path)) return;
        try {
            const forwardedFor = req.headers['x-forwarded-for'];
            const rawIp = Array.isArray(forwardedFor) ? forwardedFor[0] : (forwardedFor || req.socket.remoteAddress || '');
            const ip = String(rawIp).split(',')[0].trim().slice(0, 128);
            const userAgent = String(req.headers['user-agent'] || '').slice(0, 512);
            const referer = String(req.headers.referer || '').slice(0, 512) || null;
            const role = req.session?.role || 'guest';
            db.run(
                `INSERT INTO site_visits (method, path, userId, role, ip, userAgent, referer, isApi, statusCode, durationMs)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.method,
                    req.path,
                    req.session?.userId || null,
                    role,
                    ip || null,
                    userAgent || null,
                    referer,
                    req.path.startsWith('/api') ? 1 : 0,
                    res.statusCode || 200,
                    Date.now() - startedAt
                ]
            );
        } catch (err) {
            console.warn('Failed to track visit:', err.message);
        }
    });
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

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

        // Only admins can assign parent/admin roles; parents can only create students.
        const requestedRole = String(role || 'student').toLowerCase();
        let safeRole = 'student';
        if (req.session?.role === 'admin' && ['student', 'parent', 'admin'].includes(requestedRole)) {
            safeRole = requestedRole;
        } else if (req.session?.role === 'parent' && requestedRole === 'student') {
            safeRole = 'student';
        }

        // Check if username exists
        const existing = db.get('SELECT id FROM users WHERE username = ?', [username.toLowerCase()]);
        if (existing) return res.status(409).json({ error: 'Username already taken' });

        // Determine parentId: if a parent creates a student, link them
        let parentId = null;
        if (safeRole === 'student' && req.session?.userId) {
            const creator = db.get('SELECT id, role FROM users WHERE id = ?', [req.session.userId]);
            if (creator && (creator.role === 'parent' || creator.role === 'admin')) {
                parentId = creator.role === 'parent' ? creator.id : null;
                // Admin-created students have no parent unless explicitly set
            }
        }

        const hash = await bcrypt.hash(password, 10);
        db.run(
            'INSERT INTO users (username, displayName, password, role, avatar, parentId) VALUES (?, ?, ?, ?, ?, ?)',
            [username.toLowerCase(), displayName, hash, safeRole, avatar, parentId]
        );
        const id = db.lastInsertId();
        db.save();

        res.json({ success: true, user: { id, username: username.toLowerCase(), displayName, role: safeRole, avatar, parentId } });
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
//  USERS ROUTES
// ═══════════════════════════════════════════════════════════

// List users — admins see everyone, parents see only themselves + their kids
app.get('/api/users', requireParent, (req, res) => {
    if (req.session.role === 'admin') {
        const users = db.all('SELECT id, username, displayName, role, avatar, parentId, createdAt FROM users ORDER BY createdAt');
        return res.json({ users });
    }
    // Parent: see self + students they created
    const users = db.all(
        'SELECT id, username, displayName, role, avatar, parentId, createdAt FROM users WHERE id = ? OR parentId = ? ORDER BY createdAt',
        [req.session.userId, req.session.userId]
    );
    res.json({ users });
});

// Delete user
app.delete('/api/users/:id', requireParent, (req, res) => {
    const userId = parseInt(req.params.id);
    if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
    if (userId === req.session.userId) return res.status(400).json({ error: 'Cannot delete yourself' });

    const target = db.get('SELECT id, role, parentId FROM users WHERE id = ?', [userId]);
    if (!target) return res.status(404).json({ error: 'User not found' });

    if (req.session.role === 'parent') {
        // Parents can only delete their own kids
        if (target.parentId !== req.session.userId) {
            return res.status(403).json({ error: 'You can only manage your own children' });
        }
    } else if (req.session.role === 'admin') {
        // Admins can delete anyone except themselves (already checked above)
    }

    // Also delete any kids of the deleted user (if deleting a parent)
    if (target.role === 'parent') {
        const kids = db.all('SELECT id FROM users WHERE parentId = ?', [userId]);
        for (const kid of kids) {
            db.run('DELETE FROM lesson_results WHERE userId = ?', [kid.id]);
            db.run('DELETE FROM lesson_progress WHERE userId = ?', [kid.id]);
            db.run('DELETE FROM users WHERE id = ?', [kid.id]);
        }
    }

    db.run('DELETE FROM lesson_results WHERE userId = ?', [userId]);
    db.run('DELETE FROM lesson_progress WHERE userId = ?', [userId]);
    db.run('DELETE FROM users WHERE id = ?', [userId]);
    db.save();
    res.json({ success: true });
});

// Reset password — admins can reset anyone, parents can reset their own kids
app.post('/api/users/:id/reset-password', requireParent, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { newPassword } = req.body;
        if (Number.isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
        if (!newPassword || newPassword.length < 3) return res.status(400).json({ error: 'Password must be at least 3 characters' });

        const target = db.get('SELECT id, role, parentId FROM users WHERE id = ?', [userId]);
        if (!target) return res.status(404).json({ error: 'User not found' });

        if (req.session.role === 'parent') {
            // Parents can only reset passwords for their own kids
            if (target.parentId !== req.session.userId) {
                return res.status(403).json({ error: 'You can only reset passwords for your own children' });
            }
        }
        // Admins can reset anyone's password

        const hash = await bcrypt.hash(newPassword, 10);
        db.run('UPDATE users SET password = ? WHERE id = ?', [hash, userId]);
        db.save();

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════
//  LESSON ROUTES
// ═══════════════════════════════════════════════════════════

// Get all lessons (metadata only, no exercises)
app.get('/api/lessons', (req, res) => {
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
app.get('/api/lessons/:id', (req, res) => {
    const lesson = getLessons().find(l => l.id === req.params.id);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    res.json({ lesson });
});

// Save a new lesson (parent only — writes JSON file)
app.post('/api/lessons', requireParent, (req, res) => {
    try {
        const lesson = req.body;
        if (!lesson.id || !lesson.title) return res.status(400).json({ error: 'Lesson must have id and title' });
        if (!isSafeLessonId(lesson.id)) return res.status(400).json({ error: 'Lesson ID must contain only letters, numbers, dashes, or underscores' });

        const filepath = lessonFilePathFromId(lesson.id);
        if (!filepath) return res.status(400).json({ error: 'Invalid lesson ID' });

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
        const lessonId = req.params.id;
        if (!isSafeLessonId(lessonId)) return res.status(400).json({ error: 'Invalid lesson ID' });
        const lesson = req.body || {};
        const filepath = lessonFilePathFromId(lessonId);
        if (!filepath) return res.status(400).json({ error: 'Invalid lesson ID' });
        if (!lesson.title) return res.status(400).json({ error: 'Lesson must have title' });

        if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Lesson not found' });
        lesson.id = lessonId;

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
        const lessonId = req.params.id;
        if (!isSafeLessonId(lessonId)) return res.status(400).json({ error: 'Invalid lesson ID' });
        const filepath = lessonFilePathFromId(lessonId);
        if (!filepath) return res.status(400).json({ error: 'Invalid lesson ID' });
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
    if (userId !== req.session.userId && !['parent', 'admin'].includes(req.session.role)) {
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
//  ADMIN ANALYTICS ROUTES
// ═══════════════════════════════════════════════════════════

app.get('/api/admin/analytics', requireAdmin, (req, res) => {
    try {
        const totalVisits = db.get('SELECT COUNT(*) as count FROM site_visits');
        const visitsToday = db.get("SELECT COUNT(*) as count FROM site_visits WHERE date(visitedAt) = date('now')");
        const uniqueVisitors7d = db.get(
            "SELECT COUNT(DISTINCT ip) as count FROM site_visits WHERE visitedAt >= datetime('now', '-7 days') AND ip IS NOT NULL AND ip <> ''"
        );
        const apiCalls7d = db.get(
            "SELECT COUNT(*) as count FROM site_visits WHERE isApi = 1 AND visitedAt >= datetime('now', '-7 days')"
        );
        const pageViews7d = db.get(
            "SELECT COUNT(*) as count FROM site_visits WHERE isApi = 0 AND visitedAt >= datetime('now', '-7 days')"
        );
        const authActivity7d = db.all(
            "SELECT path, COUNT(*) as count FROM site_visits WHERE path LIKE '/api/auth/%' AND visitedAt >= datetime('now', '-7 days') GROUP BY path ORDER BY count DESC"
        );
        const topPaths14d = db.all(
            "SELECT path, COUNT(*) as visits FROM site_visits WHERE visitedAt >= datetime('now', '-14 days') GROUP BY path ORDER BY visits DESC LIMIT 20"
        );
        const dailyVisits14d = db.all(
            "SELECT date(visitedAt) as day, COUNT(*) as visits FROM site_visits WHERE visitedAt >= datetime('now', '-14 days') GROUP BY date(visitedAt) ORDER BY day"
        );
        const statusBreakdown7d = db.all(
            "SELECT statusCode, COUNT(*) as count FROM site_visits WHERE visitedAt >= datetime('now', '-7 days') GROUP BY statusCode ORDER BY count DESC"
        );
        const recent = db.all(`
            SELECT sv.visitedAt, sv.method, sv.path, sv.statusCode, sv.role, sv.ip, u.displayName
            FROM site_visits sv
            LEFT JOIN users u ON u.id = sv.userId
            ORDER BY sv.visitedAt DESC
            LIMIT 100
        `);

        res.json({
            totals: {
                totalVisits: totalVisits ? totalVisits.count : 0,
                visitsToday: visitsToday ? visitsToday.count : 0,
                uniqueVisitors7d: uniqueVisitors7d ? uniqueVisitors7d.count : 0,
                apiCalls7d: apiCalls7d ? apiCalls7d.count : 0,
                pageViews7d: pageViews7d ? pageViews7d.count : 0
            },
            authActivity7d,
            topPaths14d,
            dailyVisits14d,
            statusBreakdown7d,
            recent
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
    const parentExists = db.get("SELECT id FROM users WHERE username = 'parent'");
    if (!parentExists) {
        const hash = await bcrypt.hash('parent123', 10);
        db.run(
            "INSERT INTO users (username, displayName, password, role, avatar) VALUES (?, ?, ?, ?, ?)",
            ['parent', 'Mom & Dad', hash, 'parent', '👨‍👩‍👧‍👦']
        );
        db.save();
        console.log('👨‍👩‍👧‍👦 Default parent account created — username: parent / password: parent123');
    }

    // Ensure a default admin account exists
    const adminExists = db.get("SELECT id FROM users WHERE username = 'admin'");
    if (!adminExists) {
        const hash = await bcrypt.hash('admin123', 10);
        db.run(
            "INSERT INTO users (username, displayName, password, role, avatar) VALUES (?, ?, ?, ?, ?)",
            ['admin', 'Administrator', hash, 'admin', '🛡️']
        );
        db.save();
        console.log('🛡️  Default admin account created — username: admin / password: admin123');
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log('');
        console.log('🇷🇴  Kids Romanian Practice is running!');
        console.log(`   Local:   http://localhost:${PORT}`);
        console.log(`   Network: http://<your-ip>:${PORT}`);
        console.log('');
        console.log('   Parent login — username: parent / password: parent123');
        console.log('   Admin login  — username: admin / password: admin123');
        console.log('');
    });
}

start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
