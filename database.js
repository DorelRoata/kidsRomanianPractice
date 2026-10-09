// database.js — SQLite database layer using sql.js (WASM, no native deps)
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'app.db');
const BACKUPS_DIR = path.join(DB_DIR, 'backups');

let db = null;

// ─── Backup Helper ─────────────────────────────────────────
function createBackup(prefix = 'app') {
  try {
    if (!fs.existsSync(DB_PATH)) return null;
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUPS_DIR, `${prefix}-${dateStr}.db`);
    fs.copyFileSync(DB_PATH, backupPath);

    // Keep only the most recent 14 backups
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.db'))
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 14) {
      for (const old of files.slice(14)) {
        try { fs.unlinkSync(path.join(BACKUPS_DIR, old.name)); } catch {}
      }
    }
    return backupPath;
  } catch (err) {
    console.warn('⚠️ Backup failed:', err.message);
    return null;
  }
}

// ─── Migrations ────────────────────────────────────────────
function runMigrations(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version   INTEGER PRIMARY KEY,
      name      TEXT NOT NULL,
      appliedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  const appliedRows = [];
  try {
    const stmt = db.prepare('SELECT version FROM schema_migrations');
    while (stmt.step()) {
      appliedRows.push(stmt.getAsObject().version);
    }
    stmt.free();
  } catch {}

  const migrations = [
    {
      version: 1,
      name: 'add_user_parent_id',
      up: (d) => {
        try { d.run('ALTER TABLE users ADD COLUMN parentId INTEGER REFERENCES users(id)'); } catch {}
        try { d.run('CREATE INDEX IF NOT EXISTS idx_users_parentId ON users(parentId)'); } catch {}
      }
    },
    {
      version: 2,
      name: 'create_student_profiles',
      up: (d) => {
        d.run(`
          CREATE TABLE IF NOT EXISTS student_profiles (
            userId      INTEGER PRIMARY KEY,
            tier        TEXT NOT NULL DEFAULT 'prek', -- 'bebe' (1-3), 'prek' (3-5), 'junior' (6-8)
            birthYear   INTEGER,
            birthMonth  INTEGER,
            settings    TEXT DEFAULT '{}',
            updatedAt   TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
          )
        `);
      }
    },
    {
      version: 3,
      name: 'create_student_stickers',
      up: (d) => {
        d.run(`
          CREATE TABLE IF NOT EXISTS student_stickers (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            userId      INTEGER NOT NULL,
            stickerId   TEXT NOT NULL,
            lessonId    TEXT,
            tier        TEXT,
            unlockedAt  TEXT DEFAULT (datetime('now')),
            UNIQUE(userId, stickerId),
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
          )
        `);
        d.run('CREATE INDEX IF NOT EXISTS idx_stickers_userId ON student_stickers(userId)');
      }
    },
    {
      version: 4,
      name: 'create_attempts_log',
      up: (d) => {
        d.run(`
          CREATE TABLE IF NOT EXISTS attempts (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            userId      INTEGER,
            sessionId   TEXT,
            lessonId    TEXT NOT NULL,
            exerciseId  TEXT,
            itemWord    TEXT,
            tier        TEXT,
            isCorrect   INTEGER,
            responseMs  INTEGER DEFAULT 0,
            createdAt   TEXT DEFAULT (datetime('now'))
          )
        `);
        d.run('CREATE INDEX IF NOT EXISTS idx_attempts_user_lesson ON attempts(userId, lessonId)');
        d.run('CREATE INDEX IF NOT EXISTS idx_attempts_created ON attempts(createdAt)');
      }
    },
    {
      version: 5,
      name: 'create_lesson_sessions',
      up: (d) => {
        d.run(`
          CREATE TABLE IF NOT EXISTS lesson_sessions (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            userId          INTEGER NOT NULL,
            lessonId        TEXT NOT NULL,
            tier            TEXT NOT NULL DEFAULT 'prek',
            score           INTEGER NOT NULL DEFAULT 0,
            totalQuestions  INTEGER NOT NULL DEFAULT 0,
            percentage      REAL NOT NULL DEFAULT 0,
            stars           INTEGER NOT NULL DEFAULT 0,
            timeSpentSec    INTEGER DEFAULT 0,
            completedAt     TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
          )
        `);
        d.run('CREATE INDEX IF NOT EXISTS idx_sessions_user ON lesson_sessions(userId, lessonId)');
      }
    }
  ];

  for (const m of migrations) {
    if (!appliedRows.includes(m.version)) {
      console.log(`⚡ Running migration ${m.version}: ${m.name}`);
      createBackup(`pre-migration-${m.version}`);
      m.up(db);
      db.run('INSERT INTO schema_migrations (version, name) VALUES (?, ?)', [m.version, m.name]);
    }
  }
}

// ─── Initialise ────────────────────────────────────────────
async function initDatabase() {
  const SQL = await initSqlJs();

  fs.mkdirSync(DB_DIR, { recursive: true });
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });

  // Load existing DB or create new one
  try {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
    console.log('📂 Loaded existing database');
    createBackup('startup');
  } catch {
    db = new SQL.Database();
    console.log('🆕 Created new database');
  }

  // Base tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT    UNIQUE NOT NULL,
      displayName TEXT    NOT NULL,
      password    TEXT    NOT NULL,
      role        TEXT    NOT NULL DEFAULT 'student',
      avatar      TEXT    DEFAULT '🧒',
      createdAt   TEXT    DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS lesson_results (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      userId          INTEGER NOT NULL,
      lessonId        TEXT    NOT NULL,
      score           INTEGER NOT NULL,
      totalQuestions  INTEGER NOT NULL,
      percentage      REAL    NOT NULL,
      timeSpentSec    INTEGER DEFAULT 0,
      completedAt     TEXT    DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS lesson_progress (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      userId          INTEGER NOT NULL,
      lessonId        TEXT    NOT NULL,
      currentExercise INTEGER DEFAULT 0,
      answers         TEXT    DEFAULT '[]',
      updatedAt       TEXT    DEFAULT (datetime('now')),
      UNIQUE(userId, lessonId),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS site_visits (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      method      TEXT    NOT NULL,
      path        TEXT    NOT NULL,
      userId      INTEGER,
      role        TEXT    DEFAULT 'guest',
      ip          TEXT,
      userAgent   TEXT,
      referer     TEXT,
      isApi       INTEGER DEFAULT 0,
      statusCode  INTEGER DEFAULT 200,
      durationMs  INTEGER DEFAULT 0,
      visitedAt   TEXT    DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_site_visits_visitedAt ON site_visits(visitedAt)');
  db.run('CREATE INDEX IF NOT EXISTS idx_site_visits_path ON site_visits(path)');
  db.run('CREATE INDEX IF NOT EXISTS idx_site_visits_userId ON site_visits(userId)');

  // Run all migrations
  runMigrations(db);

  // Auto-save every 30 seconds
  setInterval(save, 30000);
  return db;
}

// ─── Atomic Save to Disk ───────────────────────────────────
function save() {
  if (!db) return;
  try {
    fs.mkdirSync(DB_DIR, { recursive: true });
    const data = db.export();
    const buffer = Buffer.from(data);
    const tempPath = `${DB_PATH}.tmp`;

    // Write to temporary file, sync to disk, then atomically rename
    const fd = fs.openSync(tempPath, 'w');
    fs.writeSync(fd, buffer, 0, buffer.length, 0);
    fs.fsyncSync(fd);
    fs.closeSync(fd);

    fs.renameSync(tempPath, DB_PATH);
  } catch (err) {
    console.error('❌ Failed to save database atomically:', err.message);
  }
}

// ─── Helpers ───────────────────────────────────────────────
function getDb() {
  if (!db) throw new Error('Database not initialised');
  return db;
}

function run(sql, params = []) {
  const d = getDb();
  d.run(sql, params);
  const [row] = d.exec('SELECT changes() as c');
  return { changes: row ? row.values[0][0] : 0 };
}

function all(sql, params = []) {
  const d = getDb();
  const stmt = d.prepare(sql);
  if (params.length) stmt.bind(params);

  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = all(sql, params);
  return rows.length ? rows[0] : null;
}

function lastInsertId() {
  const row = get('SELECT last_insert_rowid() as id');
  return row ? row.id : null;
}

module.exports = { initDatabase, save, run, all, get, lastInsertId, createBackup };
