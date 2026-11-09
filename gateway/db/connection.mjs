// gateway/db/connection.mjs — SQLite database connection with better-sqlite3

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import config from '../config.mjs';
import logger from '../logger.mjs';

let db = null;

export function getDb() {
  if (db) return db;

  // Ensure data directory exists
  const dir = path.dirname(config.db.path);
  mkdirSync(dir, { recursive: true });

  db = new Database(config.db.path);

  // Performance and safety pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -8000'); // 8MB

  logger.info('Database connected', { path: config.db.path });
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
    logger.info('Database closed');
  }
}
