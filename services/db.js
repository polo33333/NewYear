const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/database.sqlite');
const db = new Database(dbPath, { verbose: console.log });

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT,
    password TEXT,
    isAdmin INTEGER DEFAULT 0,
    isStream INTEGER DEFAULT 0,
    isStreamer INTEGER DEFAULT 0,
    isSync INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    userId TEXT PRIMARY KEY,
    obsToken TEXT,
    googleAppsScriptUrl TEXT,
    isSync INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS brackets (
    roomId TEXT PRIMARY KEY,
    data TEXT
  );

  CREATE TABLE IF NOT EXISTS saves (
    roomId TEXT PRIMARY KEY,
    data TEXT
  );

  CREATE TABLE IF NOT EXISTS characters (
    name TEXT PRIMARY KEY,
    element INTEGER,
    data TEXT
  );

  CREATE TABLE IF NOT EXISTS weapons (
    name TEXT PRIMARY KEY,
    data TEXT
  );
`);

// Migration function from JSON to SQLite
function migrateData() {
  const isMigrated = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users_migrated'").get();
  if (isMigrated) return; // Already migrated

  console.log('[SYSTEM] Migrating data from JSON to SQLite...');

  // Migrate users.json
  const usersPath = path.join(__dirname, '../data/users.json');
  if (fs.existsSync(usersPath)) {
    try {
      const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, username, password, isAdmin, isStream, isStreamer, isSync) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const insertMany = db.transaction((usersList) => {
        for (const u of usersList) {
          insertUser.run(
            String(u.id), u.username, u.password, 
            u.isAdmin ? 1 : 0, u.isStream ? 1 : 0, u.isStreamer ? 1 : 0, u.isSync ? 1 : 0
          );
        }
      });
      insertMany(users);
    } catch (e) {
      console.error('Error migrating users:', e);
    }
  }

  // Migrate settings.json
  const settingsPath = path.join(__dirname, '../data/settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      let content = fs.readFileSync(settingsPath, 'utf8');
      if (content.trim()) {
        let allSettings = JSON.parse(content);
        if (allSettings && !allSettings['1'] && (allSettings.obsToken || allSettings.googleAppsScriptUrl)) {
          allSettings = { '1': allSettings };
        }
        const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (userId, obsToken, googleAppsScriptUrl) VALUES (?, ?, ?)');
        const insertMany = db.transaction((settingsObj) => {
          for (const [userId, sett] of Object.entries(settingsObj)) {
            insertSetting.run(userId, sett.obsToken || '', sett.googleAppsScriptUrl || '');
          }
        });
        insertMany(allSettings);
      }
    } catch (e) {
      console.error('Error migrating settings:', e);
    }
  }

  // Migrate bracket_save.json
  const bracketPath = path.join(__dirname, '../data/bracket_save.json');
  if (fs.existsSync(bracketPath)) {
    try {
      let content = fs.readFileSync(bracketPath, 'utf8');
      if (content.trim()) {
        const allBrackets = JSON.parse(content);
        const insertBracket = db.prepare('INSERT OR IGNORE INTO brackets (roomId, data) VALUES (?, ?)');
        const insertMany = db.transaction((bracketsObj) => {
          for (const [roomId, data] of Object.entries(bracketsObj)) {
            insertBracket.run(roomId, JSON.stringify(data));
          }
        });
        insertMany(allBrackets);
      }
    } catch (e) {
      console.error('Error migrating brackets:', e);
    }
  }

  // Migrate saved_rosters.json
  const savesPath = path.join(__dirname, '../data/saved_rosters.json');
  if (fs.existsSync(savesPath)) {
    try {
      let content = fs.readFileSync(savesPath, 'utf8');
      if (content.trim()) {
        let allSaves = JSON.parse(content);
        if (Array.isArray(allSaves)) {
          allSaves = { '1': allSaves };
        }
        const insertSaves = db.prepare('INSERT OR IGNORE INTO saves (roomId, data) VALUES (?, ?)');
        const insertMany = db.transaction((savesObj) => {
          for (const [roomId, data] of Object.entries(savesObj)) {
            insertSaves.run(roomId, JSON.stringify(data));
          }
        });
        insertMany(allSaves);
      }
    } catch (e) {
      console.error('Error migrating saves:', e);
    }
  }

  // Mark as migrated
  db.exec("CREATE TABLE users_migrated (id INTEGER)");
  console.log('[SYSTEM] Migration to SQLite completed.');
}

migrateData();

module.exports = db;
