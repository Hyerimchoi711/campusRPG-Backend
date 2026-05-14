const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
require('dotenv').config();

const configuredPath = process.env.DB_PATH || '../database/campus_rpg.sqlite';
const dbPath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.resolve(__dirname, configuredPath);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const dbPromise = open({
  filename: dbPath,
  driver: sqlite3.Database,
}).then(async db => {
  await db.exec('PRAGMA foreign_keys = ON');
  try {
    await db.exec(
      'ALTER TABLE stats ADD COLUMN quest_daily_stat_sum INTEGER NOT NULL DEFAULT 0'
    );
  } catch (e) {
    const msg = String(e && e.message);
    if (!msg.includes('duplicate column')) {
      console.warn('[db] stats.quest_daily_stat_sum migration:', e.message);
    }
  }
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS todo_completion_reward_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date_key TEXT NOT NULL,
        client_todo_id TEXT NOT NULL,
        awarded_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE (user_id, date_key, client_todo_id)
      )
    `);
  } catch (e) {
    console.warn('[db] todo_completion_reward_claims migration:', e.message);
  }
  console.log(`Successfully connected to SQLite database: ${dbPath}`);
  return db;
});

function isReadQuery(sql) {
  return /^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql);
}

async function runQuery(db, sql, params = []) {
  if (isReadQuery(sql)) {
    const rows = await db.all(sql, params);
    return [rows];
  }

  const result = await db.run(sql, params);
  return [
    {
      insertId: result.lastID,
      lastID: result.lastID,
      affectedRows: result.changes,
      changes: result.changes,
    },
  ];
}

async function query(sql, params = []) {
  const db = await dbPromise;
  return runQuery(db, sql, params);
}

async function getConnection() {
  const db = await dbPromise;
  return {
    beginTransaction: () => db.exec('BEGIN IMMEDIATE TRANSACTION'),
    commit: () => db.exec('COMMIT'),
    rollback: () => db.exec('ROLLBACK'),
    query: (sql, params = []) => runQuery(db, sql, params),
    release: () => {},
  };
}

module.exports = {
  query,
  getConnection,
};
