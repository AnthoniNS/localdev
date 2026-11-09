// gateway/conversations/manager.mjs — Conversation and message management

import crypto from 'node:crypto';
import { getDb } from '../db/connection.mjs';
import logger from '../logger.mjs';
import { estimateTokens } from '../context/tokens.mjs';

export function createConversation({ projectId, title, model }) {
  const db = getDb();
  // Validate project exists
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) throw new Error('Project not found');

  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO conversations (id, project_id, title, model) VALUES (?, ?, ?, ?)`).run(
    id, projectId, title || 'New Conversation', model || ''
  );
  logger.info('Conversation created', { conversationId: id, projectId });
  return getConversation(id);
}

export function getConversation(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) || null;
}

export function getConversationWithProjectCheck(conversationId, projectId) {
  const db = getDb();
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND project_id = ?').get(conversationId, projectId);
  return conv || null;
}

export function listConversations({ projectId, state = 'active', limit = 50, offset = 0 } = {}) {
  const db = getDb();
  if (projectId) {
    const rows = db.prepare(
      'SELECT * FROM conversations WHERE project_id = ? AND state = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?'
    ).all(projectId, state, limit, offset);
    const total = db.prepare(
      'SELECT COUNT(*) as c FROM conversations WHERE project_id = ? AND state = ?'
    ).get(projectId, state).c;
    return { items: rows, total };
  }
  const rows = db.prepare(
    'SELECT * FROM conversations WHERE state = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?'
  ).all(state, limit, offset);
  const total = db.prepare('SELECT COUNT(*) as c FROM conversations WHERE state = ?').get(state).c;
  return { items: rows, total };
}

export function updateConversation(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];

  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.model !== undefined) { fields.push('model = ?'); values.push(updates.model); }
  if (updates.state !== undefined) { fields.push('state = ?'); values.push(updates.state); }
  if (updates.summary !== undefined) {
    fields.push('summary = ?', "summary_updated_at = datetime('now')");
    values.push(updates.summary);
  }
  if (updates.totalTokensIn !== undefined) { fields.push('total_tokens_in = ?'); values.push(updates.totalTokensIn); }
  if (updates.totalTokensOut !== undefined) { fields.push('total_tokens_out = ?'); values.push(updates.totalTokensOut); }

  if (fields.length === 0) return getConversation(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getConversation(id);
}

export function deleteConversation(id) {
  const db = getDb();
  db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  logger.info('Conversation deleted', { conversationId: id });
  return true;
}

// --- Messages ---

export function addMessage({ conversationId, projectId, role, content, name, toolCalls, toolCallId, metadata }) {
  const db = getDb();
  const id = crypto.randomUUID();
  const tokensEstimated = estimateTokens(content || '');

  db.prepare(`INSERT INTO messages (id, conversation_id, project_id, role, content, name, tool_calls, tool_call_id, tokens_estimated, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, conversationId, projectId, role, content || '',
    name || null,
    toolCalls ? JSON.stringify(toolCalls) : null,
    toolCallId || null,
    tokensEstimated,
    JSON.stringify(metadata || {})
  );

  // Update conversation stats
  db.prepare(`UPDATE conversations SET
    message_count = message_count + 1,
    updated_at = datetime('now')
    WHERE id = ?`).run(conversationId);

  return { id, conversationId, projectId, role, content, tokensEstimated, createdAt: new Date().toISOString() };
}

export function getMessages(conversationId, { limit = 100, offset = 0, order = 'ASC' } = {}) {
  const db = getDb();
  const orderClause = order === 'DESC' ? 'DESC' : 'ASC';
  return db.prepare(
    `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ${orderClause} LIMIT ? OFFSET ?`
  ).all(conversationId, limit, offset);
}

export function getRecentMessages(conversationId, maxMessages = 20) {
  const db = getDb();
  // Get recent messages in chronological order
  const rows = db.prepare(
    `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?`
  ).all(conversationId, maxMessages);
  return rows.reverse();
}

export function getMessageCount(conversationId) {
  const db = getDb();
  return db.prepare('SELECT COUNT(*) as c FROM messages WHERE conversation_id = ?').get(conversationId).c;
}

export function clearConversationContext(conversationId) {
  // This doesn't delete messages, just marks a context boundary
  const db = getDb();
  db.prepare("UPDATE conversations SET summary = '', summary_updated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(conversationId);
  logger.info('Conversation context cleared', { conversationId });
}

// --- Resolve or create conversation for a request ---

export function resolveConversation({ projectId, conversationId, model }) {
  const db = getDb();

  if (conversationId) {
    // Validate it belongs to this project
    const conv = getConversationWithProjectCheck(conversationId, projectId);
    if (!conv) {
      throw new Error(`Conversation ${conversationId} not found or does not belong to project ${projectId}`);
    }
    return conv;
  }

  // Create a new conversation
  return createConversation({ projectId, model });
}
