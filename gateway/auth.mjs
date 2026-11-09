// gateway/auth.mjs — Authentication: password hashing, sessions, API keys

import crypto from 'node:crypto';
import { getDb } from './db/connection.mjs';
import config from './config.mjs';
import logger from './logger.mjs';

// --- Password hashing with scrypt ---

export function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

export function verifyPassword(password, hash) {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':');
    if (!salt || !key) return resolve(false);
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey));
    });
  });
}

// --- Session management ---

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const sessions = new Map();

function getSessionSecret() {
  if (config.auth.sessionSecret) return config.auth.sessionSecret;
  // Generate and store one
  const secret = crypto.randomBytes(32).toString('hex');
  config.auth.sessionSecret = secret;
  return secret;
}

export function createSession(userId, role = 'admin') {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + SESSION_DURATION;
  sessions.set(sessionId, { userId, role, expires });

  // Sign the session ID
  const hmac = crypto.createHmac('sha256', getSessionSecret());
  hmac.update(sessionId);
  const signature = hmac.digest('hex');

  return { token: `${sessionId}.${signature}`, expires };
}

export function validateSession(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [sessionId, signature] = parts;

  // Verify signature
  const hmac = crypto.createHmac('sha256', getSessionSecret());
  hmac.update(sessionId);
  const expectedSig = hmac.digest('hex');
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expectedSig, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  const session = sessions.get(sessionId);
  if (!session) return null;
  if (session.expires < Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

export function destroySession(token) {
  if (!token) return;
  const parts = token.split('.');
  if (parts.length === 2) {
    sessions.delete(parts[0]);
  }
}

// Cleanup expired sessions periodically
const sessionCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (s.expires < now) sessions.delete(id);
  }
}, 10 * 60 * 1000); // every 10 min
sessionCleanupInterval.unref();

// --- API Key validation ---

export function validateApiKey(key) {
  if (!config.auth.apiKey) return true; // No API key configured = allow all
  if (!key) return false;
  // Strip 'Bearer ' prefix
  const clean = key.startsWith('Bearer ') ? key.slice(7).trim() : key.trim();
  return clean === config.auth.apiKey;
}

// --- Admin user initialization ---

export async function ensureAdminUser() {
  const db = getDb();
  const existing = db.prepare('SELECT id, password_hash FROM auth_users WHERE username = ?').get('admin');

  if (existing) {
    if (config.auth.adminPassword) {
      const matches = await verifyPassword(config.auth.adminPassword, existing.password_hash);
      if (!matches) {
        const newHash = await hashPassword(config.auth.adminPassword);
        db.prepare('UPDATE auth_users SET password_hash = ?, updated_at = datetime("now") WHERE username = ?').run(newHash, 'admin');
        logger.info('Senha de admin sincronizada com ADMIN_PASSWORD do .env');
      }
    }
    return;
  }

  let password = config.auth.adminPassword;
  if (!password) {
    // Generate a random password and display it
    password = crypto.randomBytes(12).toString('base64url');
    logger.warn('Generated admin password (save this!)', { password });
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║  Admin password generated (save this!):          ║');
    console.log(`║  ${password.padEnd(47)}║`);
    console.log('║  Set ADMIN_PASSWORD in .env to use your own.     ║');
    console.log('╚══════════════════════════════════════════════════╝\n');
  }

  const hash = await hashPassword(password);
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO auth_users (id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(
    id, 'admin', hash, 'admin'
  );
  logger.info('Admin user created');
}

// --- Request authentication middleware helpers ---

export function parseSessionCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/localdevai_session=([^;]+)/);
  return match ? match[1] : null;
}

export function parseBearerToken(authHeader) {
  if (!authHeader) return null;
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return authHeader.trim();
}
