// gateway/tasks/manager.mjs — Task tracking, checkpoints and seamless session continuity

import crypto from 'node:crypto';
import { getDb } from '../db/connection.mjs';
import logger from '../logger.mjs';
import { createConversation, addMessage } from '../conversations/manager.mjs';
import { getProject } from '../projects/manager.mjs';

/**
 * Create a new autonomous development task
 */
export function createTask({ projectId, title, objective = '', description = '' }) {
  const db = getDb();
  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO tasks (id, project_id, title, description, objective, state, session_count, progress_pct)
    VALUES (?, ?, ?, ?, ?, 'in_progress', 1, 0)
  `).run(id, projectId, title || 'Nova Tarefa de Desenvolvimento', description, objective || title);

  logger.info('Tarefa criada', { taskId: id, projectId, title });
  return getTask(id);
}

/**
 * Get task by ID
 */
export function getTask(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  return row ? deserializeTask(row) : null;
}

/**
 * List tasks for a project
 */
export function listTasks(projectId = null, state = null, limit = 50) {
  const db = getDb();
  const conditions = [];
  const params = [];

  if (projectId) { conditions.push('project_id = ?'); params.push(projectId); }
  if (state) { conditions.push('state = ?'); params.push(state); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM tasks ${where} ORDER BY updated_at DESC LIMIT ?`).all(...params, limit);
  return rows.map(deserializeTask);
}

/**
 * Get the currently active in-progress task for a project
 */
export function getActiveTask(projectId) {
  const db = getDb();
  if (projectId) {
    const row = db.prepare("SELECT * FROM tasks WHERE project_id = ? AND state = 'in_progress' ORDER BY updated_at DESC LIMIT 1").get(projectId);
    if (row) return deserializeTask(row);
  }
  const globalLatest = db.prepare("SELECT * FROM tasks WHERE state = 'in_progress' ORDER BY updated_at DESC LIMIT 1").get();
  return globalLatest ? deserializeTask(globalLatest) : null;
}

/**
 * Update task attributes
 */
export function updateTask(id, updates = {}) {
  const db = getDb();
  const fields = [];
  const values = [];

  const allowed = ['title', 'description', 'objective', 'state', 'current_session_id', 'session_count', 'progress_pct'];
  for (const key of allowed) {
    const camel = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    if (updates[camel] !== undefined || updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[camel] !== undefined ? updates[camel] : updates[key]);
    }
  }

  if (fields.length === 0) return getTask(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getTask(id);
}

/**
 * Save a persistent task checkpoint
 */
export function saveCheckpoint(taskId, data = {}) {
  const db = getDb();
  const task = getTask(taskId);
  if (!task) throw new Error(`Tarefa ${taskId} não encontrada para criar checkpoint.`);

  const id = crypto.randomUUID();
  const latestIndex = db.prepare('SELECT MAX(checkpoint_index) as max_idx FROM task_checkpoints WHERE task_id = ?').get(taskId)?.max_idx || 0;
  const newIndex = latestIndex + 1;

  db.prepare(`
    INSERT INTO task_checkpoints (
      id, task_id, project_id, session_id, checkpoint_index, objective,
      completed_steps, pending_steps, files_created, files_modified,
      technical_decisions, errors_encountered, test_results, next_action,
      context_token_usage, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    taskId,
    task.projectId,
    data.sessionId || task.currentSessionId || null,
    newIndex,
    data.objective || task.objective,
    JSON.stringify(data.completedSteps || []),
    JSON.stringify(data.pendingSteps || []),
    JSON.stringify(data.filesCreated || []),
    JSON.stringify(data.filesModified || []),
    JSON.stringify(data.technicalDecisions || []),
    JSON.stringify(data.errorsEncountered || []),
    JSON.stringify(data.testResults || []),
    data.nextAction || 'Continuar próximo passo',
    data.contextTokenUsage || 0,
    JSON.stringify(data.metadata || {})
  );

  // Update task's progress and updated_at
  if (data.progressPct !== undefined) {
    updateTask(taskId, { progressPct: data.progressPct });
  } else {
    updateTask(taskId, {});
  }

  logger.info('Checkpoint persistido com sucesso', { taskId, checkpointIndex: newIndex });
  return getCheckpoint(id);
}

/**
 * Get checkpoint by ID
 */
export function getCheckpoint(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM task_checkpoints WHERE id = ?').get(id);
  return row ? deserializeCheckpoint(row) : null;
}

/**
 * Get the latest checkpoint for a task
 */
export function getLatestCheckpoint(taskId) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM task_checkpoints WHERE task_id = ? ORDER BY checkpoint_index DESC LIMIT 1').get(taskId);
  return row ? deserializeCheckpoint(row) : null;
}

/**
 * Automatically create a new session for a task near the token limit, restoring the individual system prompt and progress
 */
export async function continueTaskInNewSession(taskId) {
  const task = getTask(taskId);
  if (!task) throw new Error(`Tarefa ${taskId} não encontrada`);

  const project = getProject(task.projectId);
  const checkpoint = getLatestCheckpoint(taskId);
  const newSessionIndex = (task.sessionCount || 1) + 1;

  // 1. Create new session conversation
  const newConv = createConversation({
    projectId: task.projectId,
    title: `${task.title} (Sessão ${newSessionIndex})`,
    model: project?.defaultModel || 'local-model'
  });

  // Associate session with task
  const db = getDb();
  db.prepare('UPDATE conversations SET task_id = ?, session_index = ? WHERE id = ?').run(
    taskId, newSessionIndex, newConv.id
  );

  updateTask(taskId, {
    currentSessionId: newConv.id,
    sessionCount: newSessionIndex
  });

  // 2. Build continuation prompt maintaining context without repeating operations
  const contPrompt = buildContinuationPrompt(task, checkpoint, newSessionIndex, project);

  addMessage({
    conversationId: newConv.id,
    projectId: task.projectId,
    role: 'system',
    content: contPrompt,
    tokensEstimated: Math.round(contPrompt.length / 4)
  });

  logger.info('Sessão continuada automaticamente com checkpoint restaurado', {
    taskId,
    newSessionId: newConv.id,
    sessionIndex: newSessionIndex
  });

  return {
    taskId,
    newSessionId: newConv.id,
    sessionIndex: newSessionIndex,
    checkpoint
  };
}

function buildContinuationPrompt(task, checkpoint, sessionIndex, project) {
  let prompt = `=== CONTINUIDADE AUTOMÁTICA DE TAREFA (Sessão ${sessionIndex}) ===\n`;
  prompt += `Projeto: ${project?.name || 'LocalDevAI'}\n`;
  prompt += `Objetivo Geral: ${task.objective || task.title}\n\n`;

  if (checkpoint) {
    prompt += `🧠 ESTADO RESTAURADO (Você não perdeu o contexto):\n`;
    if (checkpoint.completedSteps?.length) {
      prompt += `✅ Concluído:\n  - ${checkpoint.completedSteps.join('\n  - ')}\n`;
    }
    if (checkpoint.filesCreated?.length || checkpoint.filesModified?.length) {
      const files = [...(checkpoint.filesCreated || []), ...(checkpoint.filesModified || [])];
      prompt += `📁 Arquivos trabalhados: ${[...new Set(files)].join(', ')}\n`;
    }
    if (checkpoint.technicalDecisions?.length) {
      prompt += `⚙️ Decisões Técnicas:\n  - ${checkpoint.technicalDecisions.join('\n  - ')}\n`;
    }
    if (checkpoint.errorsEncountered?.length) {
      prompt += `⚠️ Erros já resolvidos (não repetir): ${checkpoint.errorsEncountered.join('; ')}\n`;
    }
    prompt += `\n🎯 PRÓXIMA AÇÃO EXATA:\n👉 ${checkpoint.nextAction || 'Continuar a partir do próximo passo pendente sem repetir tarefas já executadas.'}\n`;
  } else {
    prompt += `Iniciando nova fase de execução para o objetivo: ${task.objective}.\n`;
  }

  prompt += `\n⚠️ REGRAS DE CONTINUIDADE:\n`;
  prompt += `1. NÃO reinicie o trabalho do zero.\n`;
  prompt += `2. NÃO peça confirmação de etapas já marcadas como concluídas.\n`;
  prompt += `3. Retome o raciocínio exatamente a partir da 'PRÓXIMA AÇÃO EXATA' acima.\n`;
  return prompt;
}

function deserializeTask(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    objective: row.objective,
    state: row.state,
    currentSessionId: row.current_session_id,
    sessionCount: row.session_count || 1,
    progressPct: row.progress_pct || 0,
    metadata: safeParse(row.metadata, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function deserializeCheckpoint(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    projectId: row.project_id,
    sessionId: row.session_id,
    checkpointIndex: row.checkpoint_index,
    objective: row.objective,
    completedSteps: safeParse(row.completed_steps, []),
    pendingSteps: safeParse(row.pending_steps, []),
    filesCreated: safeParse(row.files_created, []),
    filesModified: safeParse(row.files_modified, []),
    technicalDecisions: safeParse(row.technical_decisions, []),
    errorsEncountered: safeParse(row.errors_encountered, []),
    testResults: safeParse(row.test_results, []),
    nextAction: row.next_action,
    contextTokenUsage: row.context_token_usage || 0,
    metadata: safeParse(row.metadata, {}),
    createdAt: row.created_at
  };
}

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}
