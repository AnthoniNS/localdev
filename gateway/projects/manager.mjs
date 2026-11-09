// gateway/projects/manager.mjs — Project management with isolation

import crypto from 'node:crypto';
import { getDb } from '../db/connection.mjs';
import logger from '../logger.mjs';

export function createProject({ name, description, workDir, languages, frameworks, defaultModel, systemPrompt, memoryEnabled, ragEnabled }) {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO projects (id, name, description, work_dir, languages, frameworks, default_model, system_prompt, memory_enabled, rag_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id,
    name || 'Untitled Project',
    description || '',
    workDir || '',
    JSON.stringify(languages || []),
    JSON.stringify(frameworks || []),
    defaultModel || '',
    systemPrompt || '',
    memoryEnabled !== false ? 1 : 0,
    ragEnabled !== false ? 1 : 0
  );
  logger.info('Project created', { projectId: id, name });
  return getProject(id);
}

export function getProject(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!row) return null;
  return deserializeProject(row);
}

export function listProjects({ state = 'active', limit = 50, offset = 0 } = {}) {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM projects WHERE state = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?'
  ).all(state, limit, offset);
  const total = db.prepare('SELECT COUNT(*) as count FROM projects WHERE state = ?').get(state).count;
  return { items: rows.map(deserializeProject), total };
}

export function updateProject(id, updates) {
  const db = getDb();
  const project = getProject(id);
  if (!project) return null;

  const fields = [];
  const values = [];

  const allowed = {
    name: 'name', description: 'description', workDir: 'work_dir',
    defaultModel: 'default_model', systemPrompt: 'system_prompt',
    memoryEnabled: 'memory_enabled', ragEnabled: 'rag_enabled', state: 'state',
  };
  const jsonFields = { languages: 'languages', frameworks: 'frameworks', contextConfig: 'context_config' };

  for (const [jsKey, dbKey] of Object.entries(allowed)) {
    if (updates[jsKey] !== undefined) {
      fields.push(`${dbKey} = ?`);
      if (dbKey === 'memory_enabled' || dbKey === 'rag_enabled') {
        values.push(updates[jsKey] ? 1 : 0);
      } else {
        values.push(updates[jsKey]);
      }
    }
  }
  for (const [jsKey, dbKey] of Object.entries(jsonFields)) {
    if (updates[jsKey] !== undefined) {
      fields.push(`${dbKey} = ?`);
      values.push(JSON.stringify(updates[jsKey]));
    }
  }

  if (fields.length === 0) return project;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  logger.info('Project updated', { projectId: id });
  return getProject(id);
}

export function archiveProject(id) {
  return updateProject(id, { state: 'archived' });
}

export function deleteProject(id) {
  const db = getDb();
  const project = getProject(id);
  if (!project) return false;

  // Cascade delete is handled by foreign keys
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  logger.info('Project deleted', { projectId: id, name: project.name });
  return true;
}

export function getProjectStats(id) {
  const db = getDb();
  const conversationCount = db.prepare('SELECT COUNT(*) as c FROM conversations WHERE project_id = ?').get(id).c;
  const messageCount = db.prepare('SELECT COUNT(*) as c FROM messages WHERE project_id = ?').get(id).c;
  const memoryCount = db.prepare('SELECT COUNT(*) as c FROM memories WHERE project_id = ? AND state = ?').get(id, 'active').c;
  const sourceCount = db.prepare("SELECT COUNT(*) as c FROM knowledge_sources WHERE (project_id = ? OR scope = 'global') AND enabled = 1").get(id).c;
  return { conversationCount, messageCount, memoryCount, sourceCount };
}

function deserializeProject(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    workDir: row.work_dir,
    languages: safeParse(row.languages, []),
    frameworks: safeParse(row.frameworks, []),
    defaultModel: row.default_model,
    contextConfig: safeParse(row.context_config, {}),
    systemPrompt: row.system_prompt,
    memoryEnabled: !!row.memory_enabled,
    ragEnabled: !!row.rag_enabled,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}
