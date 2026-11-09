// gateway/web/cache.mjs — Persistent web cache using SQLite web_cache table and memory

import crypto from 'node:crypto';
import { getDb } from '../db/connection.mjs';
import logger from '../logger.mjs';

function hashUrl(url) {
  return crypto.createHash('sha256').update(url.trim()).digest('hex');
}

/**
 * Get cached page by URL if not expired
 */
export function getCachedPage(url) {
  try {
    const db = getDb();
    const hash = hashUrl(url);
    const row = db.prepare(`
      SELECT * FROM web_cache 
      WHERE url_hash = ? AND datetime(expires_at) > datetime('now')
    `).get(hash);

    if (row) {
      return {
        url: row.url,
        title: row.title,
        description: row.description,
        content: row.content,
        statusCode: row.status_code,
        contentType: row.content_type,
        cachedAt: row.created_at,
        expiresAt: row.expires_at,
        fromCache: true
      };
    }
  } catch (err) {
    logger.warn('Erro ao ler cache web', { url, error: err.message });
  }
  return null;
}

/**
 * Save page to web cache
 */
export function setCachedPage(url, data, ttlSeconds = 3600) {
  try {
    const db = getDb();
    const hash = hashUrl(url);
    const ttl = Math.max(60, ttlSeconds);

    db.prepare(`
      INSERT INTO web_cache (url_hash, url, title, description, content, status_code, content_type, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ? || ' seconds'), datetime('now'))
      ON CONFLICT(url_hash) DO UPDATE SET
        url = excluded.url,
        title = excluded.title,
        description = excluded.description,
        content = excluded.content,
        status_code = excluded.status_code,
        content_type = excluded.content_type,
        expires_at = datetime('now', ? || ' seconds'),
        created_at = datetime('now')
    `).run(
      hash,
      url,
      data.title || '',
      data.description || '',
      data.content || '',
      data.statusCode || 200,
      data.contentType || 'text/html',
      String(ttl),
      String(ttl)
    );
  } catch (err) {
    logger.warn('Erro ao gravar cache web', { url, error: err.message });
  }
}

/**
 * Clean up expired cache entries
 */
export function purgeExpiredCache() {
  try {
    const db = getDb();
    const res = db.prepare("DELETE FROM web_cache WHERE datetime(expires_at) <= datetime('now')").run();
    return res.changes || 0;
  } catch (err) {
    logger.warn('Erro ao purgar cache web expirado', { error: err.message });
    return 0;
  }
}
