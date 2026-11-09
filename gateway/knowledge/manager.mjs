// gateway/knowledge/manager.mjs — Knowledge source management

import crypto from 'node:crypto';
import { getDb } from '../db/connection.mjs';
import logger from '../logger.mjs';

export function createSource({ name, url, description, category, subcategory, sourceType, scope, projectId, language, tags, priority, crawlMode, crawlDepth, refreshInterval }) {
  const db = getDb();
  const id = crypto.randomUUID();

  // Validate scope
  if (scope === 'project' && !projectId) {
    throw new Error('project_id is required for project-scoped sources');
  }

  db.prepare(`INSERT INTO knowledge_sources
    (id, name, url, description, category, subcategory, source_type, scope, project_id,
     language, tags, priority, crawl_mode, crawl_depth, refresh_interval)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, name, url, description || '', category || '', subcategory || '',
    sourceType || 'documentation', scope || 'global', projectId || null,
    language || 'en', JSON.stringify(tags || []), priority || 5,
    crawlMode || 'single', crawlDepth || 1, refreshInterval || 0
  );

  logger.info('Knowledge source created', { sourceId: id, name, url });
  return getSource(id);
}

export function getSource(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM knowledge_sources WHERE id = ?').get(id);
  return row ? deserializeSource(row) : null;
}

export function listSources({ scope, projectId, enabled, state, category, limit = 50, offset = 0 } = {}) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (scope) { conditions.push('scope = ?'); params.push(scope); }
  if (projectId) { conditions.push("(project_id = ? OR scope = 'global')"); params.push(projectId); }
  if (enabled !== undefined) { conditions.push('enabled = ?'); params.push(enabled ? 1 : 0); }
  if (state) { conditions.push('state = ?'); params.push(state); }
  if (category) { conditions.push('category = ?'); params.push(category); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(
    `SELECT * FROM knowledge_sources ${where} ORDER BY priority DESC, name ASC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) as c FROM knowledge_sources ${where}`).get(...params).c;

  return { items: rows.map(deserializeSource), total };
}

export function updateSource(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];

  const directFields = {
    name: 'name', url: 'url', description: 'description',
    category: 'category', subcategory: 'subcategory',
    sourceType: 'source_type', scope: 'scope', projectId: 'project_id',
    language: 'language', priority: 'priority',
    crawlMode: 'crawl_mode', crawlDepth: 'crawl_depth',
    refreshInterval: 'refresh_interval', state: 'state',
  };

  for (const [jsKey, dbKey] of Object.entries(directFields)) {
    if (updates[jsKey] !== undefined) {
      fields.push(`${dbKey} = ?`);
      values.push(updates[jsKey]);
    }
  }

  if (updates.enabled !== undefined) {
    fields.push('enabled = ?');
    values.push(updates.enabled ? 1 : 0);
  }

  if (updates.tags !== undefined) {
    fields.push('tags = ?');
    values.push(JSON.stringify(updates.tags));
  }

  if (fields.length === 0) return getSource(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE knowledge_sources SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getSource(id);
}

export function deleteSource(id) {
  const db = getDb();
  // Cascade deletes docs and chunks via foreign keys
  db.prepare('DELETE FROM knowledge_sources WHERE id = ?').run(id);
  logger.info('Knowledge source deleted', { sourceId: id });
  return true;
}

export function getSourceDocuments(sourceId, { limit = 50, offset = 0 } = {}) {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM knowledge_documents WHERE source_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?'
  ).all(sourceId, limit, offset);
  const total = db.prepare('SELECT COUNT(*) as c FROM knowledge_documents WHERE source_id = ?').get(sourceId).c;
  return { items: rows, total };
}

export function getSourceChunks(sourceId, { limit = 50, offset = 0 } = {}) {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM knowledge_chunks WHERE source_id = ? ORDER BY position ASC LIMIT ? OFFSET ?'
  ).all(sourceId, limit, offset);
  const total = db.prepare('SELECT COUNT(*) as c FROM knowledge_chunks WHERE source_id = ?').get(sourceId).c;
  return { items: rows, total };
}

export function getIngestionLog(sourceId, { limit = 20 } = {}) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM ingestion_log WHERE source_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(sourceId, limit);
}

export function getSourceStats() {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as c FROM knowledge_sources').get().c;
  const ready = db.prepare("SELECT COUNT(*) as c FROM knowledge_sources WHERE state = 'ready'").get().c;
  const totalChunks = db.prepare('SELECT COUNT(*) as c FROM knowledge_chunks').get().c;
  const totalDocs = db.prepare('SELECT COUNT(*) as c FROM knowledge_documents').get().c;
  return { total, ready, totalChunks, totalDocs };
}

function deserializeSource(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    description: row.description,
    category: row.category,
    subcategory: row.subcategory,
    sourceType: row.source_type,
    scope: row.scope,
    projectId: row.project_id,
    language: row.language,
    tags: safeParse(row.tags, []),
    priority: row.priority,
    enabled: !!row.enabled,
    crawlMode: row.crawl_mode,
    crawlDepth: row.crawl_depth,
    refreshInterval: row.refresh_interval,
    lastCrawledAt: row.last_crawled_at,
    lastSuccessAt: row.last_success_at,
    lastError: row.last_error,
    contentHash: row.content_hash,
    version: row.version,
    docCount: row.doc_count,
    chunkCount: row.chunk_count,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}
