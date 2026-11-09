// gateway/memory/manager.mjs — AI memory system with scoped isolation

import crypto from 'node:crypto';
import { getDb } from '../db/connection.mjs';
import logger from '../logger.mjs';
import { estimateTokens } from '../context/tokens.mjs';

export function createMemory({ projectId, conversationId, scope, type, content, priority, origin, expiresAt, metadata }) {
  const db = getDb();
  const id = crypto.randomUUID();

  // Validate scope constraints
  if (scope === 'conversation' && !conversationId) {
    throw new Error('conversation_id is required for conversation-scoped memories');
  }
  if (scope === 'project' && !projectId) {
    throw new Error('project_id is required for project-scoped memories');
  }
  if (scope === 'global' && projectId) {
    // Global memories should not be tied to a specific project
    projectId = null;
  }

  db.prepare(`INSERT INTO memories (id, project_id, conversation_id, scope, type, content, priority, origin, expires_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id,
    projectId || null,
    conversationId || null,
    scope || 'project',
    type || 'fact',
    content,
    priority || 5,
    origin || 'manual',
    expiresAt || null,
    JSON.stringify(metadata || {})
  );

  logger.info('Memory created', { memoryId: id, scope, projectId });
  return getMemory(id);
}

export function getMemory(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
  return row ? deserializeMemory(row) : null;
}

export function listMemories({ projectId, conversationId, scope, state = 'active', limit = 50, offset = 0 } = {}) {
  const db = getDb();
  const conditions = ['state = ?'];
  const params = [state];

  if (scope) { conditions.push('scope = ?'); params.push(scope); }
  if (projectId) { conditions.push('project_id = ?'); params.push(projectId); }
  if (conversationId) { conditions.push('conversation_id = ?'); params.push(conversationId); }

  const where = conditions.join(' AND ');
  const rows = db.prepare(
    `SELECT * FROM memories WHERE ${where} ORDER BY priority DESC, updated_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) as c FROM memories WHERE ${where}`).get(...params).c;

  return { items: rows.map(deserializeMemory), total };
}

export function updateMemory(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];

  if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
  if (updates.type !== undefined) { fields.push('type = ?'); values.push(updates.type); }
  if (updates.priority !== undefined) { fields.push('priority = ?'); values.push(updates.priority); }
  if (updates.scope !== undefined) { fields.push('scope = ?'); values.push(updates.scope); }
  if (updates.state !== undefined) { fields.push('state = ?'); values.push(updates.state); }
  if (updates.expiresAt !== undefined) { fields.push('expires_at = ?'); values.push(updates.expiresAt); }

  if (fields.length === 0) return getMemory(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE memories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getMemory(id);
}

export function deleteMemory(id) {
  const db = getDb();
  db.prepare('DELETE FROM memories WHERE id = ?').run(id);
  logger.info('Memory deleted', { memoryId: id });
  return true;
}

/**
 * Select relevant memories for a request context.
 * Respects project isolation and token budget.
 */
export function selectMemories({ projectId, conversationId, queryText, maxCount = 10, maxTokens = 800 }) {
  const db = getDb();

  // Collect candidate memories from authorized scopes
  const candidates = [];

  // 1. Conversation-scoped memories (if conversation specified)
  if (conversationId) {
    const convMems = db.prepare(
      `SELECT * FROM memories WHERE conversation_id = ? AND scope = 'conversation' AND state = 'active'
       ORDER BY priority DESC, updated_at DESC LIMIT ?`
    ).all(conversationId, maxCount);
    candidates.push(...convMems);
  }

  // 2. Project-scoped memories
  if (projectId) {
    const projMems = db.prepare(
      `SELECT * FROM memories WHERE project_id = ? AND scope = 'project' AND state = 'active'
       ORDER BY priority DESC, updated_at DESC LIMIT ?`
    ).all(projectId, maxCount);
    candidates.push(...projMems);
  }

  // 3. Global memories
  const globalMems = db.prepare(
    `SELECT * FROM memories WHERE scope = 'global' AND state = 'active'
     ORDER BY priority DESC, updated_at DESC LIMIT ?`
  ).all(maxCount);
  candidates.push(...globalMems);

  // Remove expired
  const now = new Date().toISOString();
  const valid = candidates.filter(m => !m.expires_at || m.expires_at > now);

  // Deduplicate by id
  const seen = new Set();
  const unique = valid.filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  // Simple relevance scoring: priority + recency + keyword overlap
  const queryTerms = (queryText || '').toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const scored = unique.map(m => {
    let score = m.priority * 10;
    // Recency boost (last 24h = +5, last week = +2)
    const age = Date.now() - new Date(m.updated_at).getTime();
    if (age < 86400000) score += 5;
    else if (age < 604800000) score += 2;
    // Keyword overlap
    const content = m.content.toLowerCase();
    for (const term of queryTerms) {
      if (content.includes(term)) score += 3;
    }
    return { ...m, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Select within token budget
  const selected = [];
  let usedTokens = 0;

  for (const m of scored) {
    if (selected.length >= maxCount) break;
    const tokens = estimateTokens(m.content);
    if (usedTokens + tokens > maxTokens && selected.length > 0) break;
    selected.push(m);
    usedTokens += tokens;
  }

  // Mark memories as used
  const updateStmt = db.prepare("UPDATE memories SET usage_count = usage_count + 1, last_used_at = datetime('now') WHERE id = ?");
  for (const m of selected) {
    updateStmt.run(m.id);
  }

  logger.debug('Memories selected', {
    projectId, conversationId,
    candidates: unique.length, selected: selected.length, tokens: usedTokens,
  });

  return { memories: selected.map(deserializeMemory), totalTokens: usedTokens };
}

function deserializeMemory(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    conversationId: row.conversation_id,
    scope: row.scope,
    type: row.type,
    content: row.content,
    priority: row.priority,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    state: row.state,
    origin: row.origin,
    metadata: safeParse(row.metadata, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    score: row.score, // only present after scoring
  };
}

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}
