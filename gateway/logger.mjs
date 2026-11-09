// gateway/logger.mjs — Structured logger with correlation IDs

import { mkdirSync, createWriteStream } from 'node:fs';
import path from 'node:path';
import config from './config.mjs';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[config.logLevel] ?? LEVELS.info;

// Ensure log directory exists
try { mkdirSync(config.logDir, { recursive: true }); } catch { /* ok */ }

let logStream = null;
try {
  const logFile = path.join(config.logDir, `gateway-${new Date().toISOString().slice(0, 10)}.log`);
  logStream = createWriteStream(logFile, { flags: 'a' });
} catch { /* ok */ }

function formatEntry(level, msg, meta) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
  };
  if (meta) {
    // Filter out sensitive fields
    const { password, apiKey, cookie, authorization, sessionSecret, ...safe } = meta;
    if (Object.keys(safe).length > 0) entry.meta = safe;
  }
  return JSON.stringify(entry);
}

function log(level, msg, meta) {
  if (LEVELS[level] > currentLevel) return;
  const line = formatEntry(level, msg, meta);
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
  if (logStream) {
    logStream.write(line + '\n');
  }
}

const logger = {
  error: (msg, meta) => log('error', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),

  // Create a child logger with preset fields
  child(fields) {
    return {
      error: (msg, meta) => log('error', msg, { ...fields, ...meta }),
      warn: (msg, meta) => log('warn', msg, { ...fields, ...meta }),
      info: (msg, meta) => log('info', msg, { ...fields, ...meta }),
      debug: (msg, meta) => log('debug', msg, { ...fields, ...meta }),
      child(moreFields) { return logger.child({ ...fields, ...moreFields }); },
    };
  },
};

export default logger;
