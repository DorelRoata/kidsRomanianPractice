// database.js — SQLite database layer using sql.js (WASM, no native deps)
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'app.db');

let db = null;

// ─── Initialise ────────────────────────────────────────────
async function initDatabase() {
    const SQL = await initSqlJs();

    // Load existing DB or create new one
    try {
        const buf = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buf);
        console.log('📂 Loaded existing database');
    } catch {
        db = new SQL.Database();
        console.log('🆕 Created new database');
    }

    // Create tables
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

    // Auto-save every 30 seconds
    setInterval(save, 30000);
    return db;
}

// ─── Save to disk ──────────────────────────────────────────
function save() {
    if (!db) return;
    try {
        fs.mkdirSync(DB_DIR, { recursive: true });
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (err) {
        console.error('❌ Failed to save database:', err.message);
    }
}

// ─── Helpers ───────────────────────────────────────────────
function getDb() {
    if (!db) throw new Error('Database not initialised');
    return db;
}

/** Run a query that modifies data. Returns { changes } */
function run(sql, params = []) {
    const d = getDb();
    d.run(sql, params);
    const [row] = d.exec('SELECT changes() as c');
    return { changes: row ? row.values[0][0] : 0 };
}

/** Get all rows as objects */
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

/** Get first row as object or null */
function get(sql, params = []) {
    const rows = all(sql, params);
    return rows.length ? rows[0] : null;
}

/** Get the last inserted row id */
function lastInsertId() {
    const row = get('SELECT last_insert_rowid() as id');
    return row ? row.id : null;
}

module.exports = { initDatabase, save, run, all, get, lastInsertId };
