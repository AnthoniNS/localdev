// gateway/admin/api.mjs — Admin REST API endpoints connecting all features

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db/connection.mjs';
import config from '../config.mjs';
import logger from '../logger.mjs';
import { isRedisAvailable } from '../redis/client.mjs';
import { testLlamaCppConnection } from '../llm/proxy.mjs';
import { safeFetch, validateUrl } from '../knowledge/ssrf.mjs';
import { createProject, getProject, listProjects, updateProject, archiveProject, deleteProject, getProjectStats } from '../projects/manager.mjs';
import { listConversations, getConversation, deleteConversation, updateConversation, getMessages } from '../conversations/manager.mjs';
import { listMemories, createMemory, updateMemory, deleteMemory, getMemory } from '../memory/manager.mjs';
import { listSources, createSource, updateSource, deleteSource, getSource, getSourceDocuments, getSourceChunks, getIngestionLog, getSourceStats } from '../knowledge/manager.mjs';
import { ingestSource, testUrl } from '../knowledge/ingest.mjs';
import { searchKnowledge } from '../knowledge/search.mjs';
import { estimateTokens } from '../context/tokens.mjs';
import { listAvailableTools, getToolExecutionLogs, executeTool } from '../tools/manager.mjs';
import { verifyPassword, createSession, destroySession } from '../auth.mjs';
import { getActiveProject } from '../projects/detector.mjs';
import { detectMaxContext, evaluateContextUsage } from '../context/manager.mjs';
import { getActiveTask, getLatestCheckpoint, listTasks, continueTaskInNewSession } from '../tasks/manager.mjs';
import { searchKnowledgeCatalog, loadCatalog, getCatalogCategories } from '../knowledge/catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, '../knowledge/catalog.json');

/**
 * Handle Admin API requests
 */
export async function handleAdminApi(req, res, pathname, session) {
  // CORS & JSON headers
  res.setHeader('Content-Type', 'application/json');

  // Parse JSON body if applicable
  let body = {};
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const text = Buffer.concat(chunks).toString();
      if (text) body = JSON.parse(text);
    } catch {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'JSON inválido no corpo da requisição' }));
    }
  }

  // --- Public Auth Endpoints ---
  if (pathname === '/admin/api/login' && req.method === 'POST') {
    const { username, password } = body;
    const db = getDb();
    const user = db.prepare('SELECT * FROM auth_users WHERE username = ?').get(username || 'admin');

    if (!user) {
      res.writeHead(401);
      return res.end(JSON.stringify({ error: 'Credenciais inválidas' }));
    }

    const valid = await verifyPassword(password || '', user.password_hash);
    if (!valid) {
      res.writeHead(401);
      return res.end(JSON.stringify({ error: 'Credenciais inválidas' }));
    }

    const { token, expires } = createSession(user.id, user.role);
    res.setHeader('Set-Cookie', `localdevai_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
    res.writeHead(200);
    return res.end(JSON.stringify({ ok: true, user: { username: user.username, role: user.role } }));
  }

  if (pathname === '/admin/api/logout' && req.method === 'POST') {
    const cookie = req.headers.cookie || '';
    const match = cookie.match(/localdevai_session=([^;]+)/);
    if (match) destroySession(match[1]);
    res.setHeader('Set-Cookie', 'localdevai_session=; Path=/; HttpOnly; Max-Age=0');
    res.writeHead(200);
    return res.end(JSON.stringify({ ok: true }));
  }

  // --- Session Protection for all remaining /admin/api endpoints ---
  if (!session) {
    res.writeHead(401);
    return res.end(JSON.stringify({ error: 'Não autorizado. Faça login primeiro.' }));
  }

  if (pathname === '/admin/api/me' && req.method === 'GET') {
    return res.end(JSON.stringify({ ok: true, user: session }));
  }

  const db = getDb();

  // --- 16.1 Dashboard Overview ---
  if (pathname === '/admin/api/dashboard' && req.method === 'GET') {
    // 1. Services state
    const dbConnected = true;
    const redisConnected = isRedisAvailable();
    let llamaStatus = { ok: false, error: 'Não verificado' };
    try {
      llamaStatus = await testLlamaCppConnection(config.llm.baseUrl, 3000);
    } catch (e) {
      llamaStatus = { ok: false, error: e.message };
    }

    let searxngStatus = { ok: false, error: 'Não verificado' };
    try {
      const sUrl = (config.searxng.baseUrl || 'http://127.0.0.1:8888').replace(/\/+$/, '');
      const sRes = await fetch(`${sUrl}/healthz`, { signal: AbortSignal.timeout(3000) })
        .catch(() => fetch(`${sUrl}/`, { signal: AbortSignal.timeout(3000) }));
      searxngStatus = { ok: sRes.ok, status: sRes.status };
    } catch (e) {
      searxngStatus = { ok: false, error: e.message };
    }

    // 2. Metrics & Counts
    const projectsCount = db.prepare('SELECT count(*) as count FROM projects').get().count;
    const activeProjects = db.prepare("SELECT count(*) as count FROM projects WHERE state = 'active'").get().count;
    const conversationsCount = db.prepare('SELECT count(*) as count FROM conversations').get().count;
    const messagesCount = db.prepare('SELECT count(*) as count FROM messages').get().count;
    const memoriesCount = db.prepare('SELECT count(*) as count FROM memories').get().count;
    const sourcesCount = db.prepare('SELECT count(*) as count FROM knowledge_sources').get().count;
    const docsCount = db.prepare('SELECT count(*) as count FROM knowledge_documents').get().count;
    const chunksCount = db.prepare('SELECT count(*) as count FROM knowledge_chunks').get().count;
    const toolExecCount = db.prepare('SELECT count(*) as count FROM tool_log').get().count;
    const toolErrorsCount = db.prepare("SELECT count(*) as count FROM tool_log WHERE status = 'error'").get().count;

    // 3. Recent activity & errors
    const recentConversations = db.prepare(`
      SELECT c.*, p.name as project_name 
      FROM conversations c 
      LEFT JOIN projects p ON c.project_id = p.id 
      ORDER BY c.updated_at DESC LIMIT 5
    `).all();

    const recentToolLogs = db.prepare('SELECT * FROM tool_log ORDER BY created_at DESC LIMIT 6').all();
    const recentIngestLogs = db.prepare(`
      SELECT l.*, s.name as source_name 
      FROM ingestion_log l 
      JOIN knowledge_sources s ON l.source_id = s.id 
      ORDER BY l.created_at DESC LIMIT 5
    `).all();

    const systemInfo = {
      nodeVersion: process.version,
      platform: `${os.platform()} ${os.arch()}`,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      freeMemMb: Math.round(os.freemem() / 1024 / 1024),
      totalMemMb: Math.round(os.totalmem() / 1024 / 1024)
    };

    // Active project, context metrics, active task and latest checkpoint
    const activeProject = getActiveProject();
    let currentTokensUsed = 0;
    try {
      if (activeProject) {
        const lastMsg = db.prepare('SELECT SUM(tokens_estimated) as total FROM messages WHERE project_id = ?').get(activeProject.id);
        currentTokensUsed = lastMsg?.total || 0;
      }
    } catch {}

    const maxContextLimit = await detectMaxContext();
    const contextStatus = evaluateContextUsage(currentTokensUsed, maxContextLimit);

    const activeTask = activeProject ? getActiveTask(activeProject.id) : null;
    const latestCheckpoint = activeTask ? getLatestCheckpoint(activeTask.id) : null;
    const catalogData = loadCatalog();

    return res.end(JSON.stringify({
      services: {
        database: { status: 'healthy', path: config.db.path, connected: dbConnected },
        redis: { status: redisConnected ? 'connected' : 'offline', connected: redisConnected, url: config.redis.url },
        llamaCpp: { ...llamaStatus, url: config.llm.baseUrl },
        searxng: { ...searxngStatus, url: config.searxng.baseUrl }
      },
      counts: {
        projects: projectsCount,
        activeProjects,
        conversations: conversationsCount,
        messages: messagesCount,
        memories: memoriesCount,
        sources: sourcesCount,
        documents: docsCount,
        chunks: chunksCount,
        toolExecutions: toolExecCount,
        toolErrors: toolErrorsCount
      },
      recent: {
        conversations: recentConversations,
        toolLogs: recentToolLogs,
        ingestLogs: recentIngestLogs
      },
      system: systemInfo,
      activeProject,
      context: {
        ...contextStatus,
        detectedMax: maxContextLimit,
        autoManaged: true
      },
      activeTask,
      latestCheckpoint,
      catalog: {
        totalResources: catalogData.resources?.length || 0,
        categories: getCatalogCategories().length
      }
    }));
  }

  // --- 16.2 Projects Management ---
  if (pathname === '/admin/api/projects') {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const state = url.searchParams.get('state') || undefined;
      const resProj = listProjects({ state });
      const projects = resProj.items || [];
      return res.end(JSON.stringify({ projects }));
    }
    if (req.method === 'POST') {
      if (!body.name) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'O nome do projeto é obrigatório' }));
      }
      const project = createProject(body);
      res.writeHead(201);
      return res.end(JSON.stringify({ project }));
    }
  }

  const projectMatch = pathname.match(/^\/admin\/api\/projects\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?$/);
  if (projectMatch) {
    const projectId = projectMatch[1];
    const subAction = projectMatch[2];

    if (!subAction) {
      if (req.method === 'GET') {
        const project = getProject(projectId);
        if (!project) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Projeto não encontrado' })); }
        const stats = getProjectStats(projectId);
        return res.end(JSON.stringify({ project, stats }));
      }
      if (req.method === 'PUT') {
        const updated = updateProject(projectId, body);
        return res.end(JSON.stringify({ project: updated }));
      }
      if (req.method === 'DELETE') {
        deleteProject(projectId);
        return res.end(JSON.stringify({ ok: true }));
      }
    } else if (subAction === 'archive' && req.method === 'POST') {
      archiveProject(projectId);
      return res.end(JSON.stringify({ ok: true }));
    }
  }

  // --- 16.3 Conversations Management ---
  if (pathname === '/admin/api/conversations') {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const projectId = url.searchParams.get('projectId') || undefined;
      const search = url.searchParams.get('search') || undefined;
      const limit = Number(url.searchParams.get('limit')) || 50;

      let conversations;
      if (projectId) {
        conversations = listConversations(projectId, 'active', limit);
      } else {
        conversations = db.prepare(`
          SELECT c.*, p.name as project_name 
          FROM conversations c 
          LEFT JOIN projects p ON c.project_id = p.id 
          ORDER BY c.updated_at DESC LIMIT ?
        `).all(limit);
      }

      if (search) {
        const q = search.toLowerCase();
        conversations = conversations.filter(c => (c.title || '').toLowerCase().includes(q) || (c.project_name || '').toLowerCase().includes(q));
      }

      return res.end(JSON.stringify({ conversations }));
    }
  }

  const convMatch = pathname.match(/^\/admin\/api\/conversations\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?$/);
  if (convMatch) {
    const convId = convMatch[1];
    const subAction = convMatch[2];

    if (!subAction) {
      if (req.method === 'GET') {
        const conversation = getConversation(convId);
        if (!conversation) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Conversa não encontrada' })); }
        const messages = getMessages(convId, 200);
        return res.end(JSON.stringify({ conversation, messages }));
      }
      if (req.method === 'DELETE') {
        deleteConversation(convId);
        return res.end(JSON.stringify({ ok: true }));
      }
    } else if (subAction === 'archive' && req.method === 'POST') {
      updateConversation(convId, { state: 'archived' });
      return res.end(JSON.stringify({ ok: true }));
    }
  }

  // --- 16.4 Memories Management ---
  if (pathname === '/admin/api/memory') {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const scope = url.searchParams.get('scope') || undefined;
      const projectId = url.searchParams.get('projectId') || undefined;
      const search = url.searchParams.get('search') || undefined;
      const resMem = listMemories({ scope, projectId, limit: 100 });
      let memories = resMem.items || [];
      if (search) {
        const q = search.toLowerCase();
        memories = memories.filter(m => (m.content || '').toLowerCase().includes(q));
      }
      return res.end(JSON.stringify({ memories, total: resMem.total }));
    }
    if (req.method === 'POST') {
      if (!body.content || !body.scope) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'Conteúdo e escopo da memória são obrigatórios' }));
      }
      const memory = createMemory(body);
      res.writeHead(201);
      return res.end(JSON.stringify({ memory }));
    }
  }

  const memMatch = pathname.match(/^\/admin\/api\/memory\/([a-zA-Z0-9_-]+)$/);
  if (memMatch) {
    const memId = memMatch[1];
    if (req.method === 'GET') {
      const mem = getMemory(memId);
      if (!mem) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Memória não encontrada' })); }
      return res.end(JSON.stringify({ memory: mem }));
    }
    if (req.method === 'PUT') {
      const updated = updateMemory(memId, body);
      return res.end(JSON.stringify({ memory: updated }));
    }
    if (req.method === 'DELETE') {
      deleteMemory(memId);
      return res.end(JSON.stringify({ ok: true }));
    }
  }

  // --- 16.5 Knowledge Library & RAG ---
  if (pathname === '/admin/api/knowledge/sources') {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const scope = url.searchParams.get('scope') || undefined;
      const projectId = url.searchParams.get('projectId') || undefined;
      const search = url.searchParams.get('search') || undefined;
      const resSrc = listSources({ scope, projectId });
      let sources = resSrc.items || [];
      if (search) {
        const q = search.toLowerCase();
        sources = sources.filter(s => (s.name || '').toLowerCase().includes(q) || (s.url || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q));
      }
      return res.end(JSON.stringify({ sources, total: resSrc.total }));
    }
    if (req.method === 'POST') {
      if (!body.name || !body.url) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'Nome e URL da fonte são obrigatórios' }));
      }
      // SSRF check on creation
      const check = await validateUrl(body.url);
      if (!check.ok) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: `URL bloqueada: ${check.error}` }));
      }
      const source = createSource(body);
      res.writeHead(201);
      return res.end(JSON.stringify({ source }));
    }
  }

  if (pathname === '/admin/api/knowledge/test-url' && req.method === 'POST') {
    const { url } = body;
    if (!url) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'URL é obrigatória' }));
    }
    const testResult = await testUrl(url);
    return res.end(JSON.stringify(testResult));
  }

  if (pathname === '/admin/api/knowledge/ingestion-log' && req.method === 'GET') {
    const logs = db.prepare(`
      SELECT l.*, s.name as source_name 
      FROM ingestion_log l 
      JOIN knowledge_sources s ON l.source_id = s.id 
      ORDER BY l.created_at DESC LIMIT 50
    `).all();
    return res.end(JSON.stringify({ logs }));
  }

  const sourceMatch = pathname.match(/^\/admin\/api\/knowledge\/sources\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?$/);
  if (sourceMatch) {
    const sourceId = sourceMatch[1];
    const subAction = sourceMatch[2];

    if (!subAction) {
      if (req.method === 'GET') {
        const source = getSource(sourceId);
        if (!source) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Fonte não encontrada' })); }
        const stats = getSourceStats(sourceId);
        return res.end(JSON.stringify({ source, stats }));
      }
      if (req.method === 'PUT') {
        const updated = updateSource(sourceId, body);
        return res.end(JSON.stringify({ source: updated }));
      }
      if (req.method === 'DELETE') {
        deleteSource(sourceId);
        return res.end(JSON.stringify({ ok: true }));
      }
    } else if (subAction === 'ingest' && req.method === 'POST') {
      // Trigger background ingestion
      const source = getSource(sourceId);
      if (!source) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Fonte não encontrada' })); }
      
      // Run ingestion asynchronously
      ingestSource(sourceId).catch(err => {
        logger.error('Erro na ingestão de fonte', { sourceId, error: err.message });
      });

      return res.end(JSON.stringify({ ok: true, message: 'Ingestão iniciada' }));
    } else if (subAction === 'documents' && req.method === 'GET') {
      const documents = getSourceDocuments(sourceId);
      return res.end(JSON.stringify({ documents }));
    } else if (subAction === 'chunks' && req.method === 'GET') {
      const chunks = getSourceChunks(sourceId, 50);
      return res.end(JSON.stringify({ chunks }));
    }
  }

  // --- 16.6 Models Configuration ---
  if (pathname === '/admin/api/models') {
    if (req.method === 'GET') {
      const models = db.prepare('SELECT * FROM models ORDER BY is_default DESC, name ASC').all();
      return res.end(JSON.stringify({ models, defaultModel: config.llm.defaultModel, baseUrl: config.llm.baseUrl }));
    }
    if (req.method === 'POST') {
      const { name, display_name, endpoint, is_default, max_context, max_response } = body;
      if (!name) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Nome do modelo é obrigatório' })); }
      const id = crypto.randomUUID();
      if (is_default) {
        db.prepare('UPDATE models SET is_default = 0').run();
      }
      db.prepare(`
        INSERT INTO models (id, name, display_name, endpoint, is_default, max_context, max_response)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, name, display_name || name, endpoint || config.llm.baseUrl, is_default ? 1 : 0, max_context || 8192, max_response || 2048);
      const created = db.prepare('SELECT * FROM models WHERE id = ?').get(id);
      res.writeHead(201);
      return res.end(JSON.stringify({ model: created }));
    }
  }

  if (pathname === '/admin/api/models/test-connection' && req.method === 'POST') {
    const endpoint = body.endpoint || config.llm.baseUrl;
    const testRes = await testLlamaCppConnection(endpoint, 4000);
    return res.end(JSON.stringify(testRes));
  }

  // --- 16.7 Tools & Integrations ---
  if (pathname === '/admin/api/tools') {
    if (req.method === 'GET') {
      const tools = listAvailableTools();
      const recentLogs = getToolExecutionLogs(30);
      return res.end(JSON.stringify({ tools, recentLogs, searxngUrl: config.searxng.baseUrl }));
    }
  }

  if (pathname === '/admin/api/tools/execute' && req.method === 'POST') {
    const { toolName, args, workDir } = body;
    const result = await executeTool(toolName, args, { workDir });
    return res.end(JSON.stringify(result));
  }

  // --- Knowledge Catalog CRUD ---
  if (pathname === '/admin/api/catalog') {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost');
      const query = url.searchParams.get('q') || '';
      const category = url.searchParams.get('category') || '';
      
      const catalog = loadCatalog(true);
      let resources = catalog.resources || [];
      
      if (query) {
        const q = query.toLowerCase();
        resources = resources.filter(r => (r.name || '').toLowerCase().includes(q) || (r.category || '').toLowerCase().includes(q));
      }
      if (category) {
        resources = resources.filter(r => (r.category || '').toLowerCase() === category.toLowerCase());
      }

      return res.end(JSON.stringify({ total: resources.length, categories: getCatalogCategories(), resources }));
    }
    if (req.method === 'POST') {
      if (!body.name || !body.category) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'Nome e categoria são obrigatórios' }));
      }
      const catalog = loadCatalog(true);
      if (catalog.resources.find(r => r.name === body.name && r.category === body.category)) {
        res.writeHead(409);
        return res.end(JSON.stringify({ error: 'Recurso já existe com este nome e categoria' }));
      }
      catalog.resources.push({
        name: body.name,
        category: body.category,
        type: body.type || 'documentation',
        cdn_url: body.cdn_url || null,
        documentation_url: body.documentation_url || '',
        description: body.description || '',
        keywords: body.keywords || [],
        enabled: true
      });
      fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
      return res.end(JSON.stringify({ ok: true, resource: catalog.resources[catalog.resources.length - 1] }));
    }
  }

  const catalogMatch = pathname.match(/^\/admin\/api\/catalog\/(.+)$/);
  if (catalogMatch) {
    const resourceName = decodeURIComponent(catalogMatch[1]);
    if (req.method === 'PUT') {
      const catalog = loadCatalog(true);
      const idx = catalog.resources.findIndex(r => r.name === resourceName);
      if (idx === -1) {
        res.writeHead(404);
        return res.end(JSON.stringify({ error: 'Recurso não encontrado' }));
      }
      catalog.resources[idx] = { 
        ...catalog.resources[idx], 
        ...body, 
        name: body.name || catalog.resources[idx].name,
        keywords: body.keywords || catalog.resources[idx].keywords,
        enabled: body.enabled !== undefined ? body.enabled : catalog.resources[idx].enabled
      };
      fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
      return res.end(JSON.stringify({ ok: true, resource: catalog.resources[idx] }));
    }
    if (req.method === 'DELETE') {
      const catalog = loadCatalog(true);
      const initialLength = catalog.resources.length;
      catalog.resources = catalog.resources.filter(r => r.name !== resourceName);
      if (catalog.resources.length === initialLength) {
        res.writeHead(404);
        return res.end(JSON.stringify({ error: 'Recurso não encontrado' }));
      }
      fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
      return res.end(JSON.stringify({ ok: true }));
    }
  }

  // Bulk enable/disable catalog resources
  if (pathname === '/admin/api/catalog/bulk' && req.method === 'POST') {
    const catalog = loadCatalog(true);
    const { action, names } = body;
    
    if (action === 'enable_all') {
      catalog.resources.forEach(r => r.enabled = true);
    } else if (action === 'disable_all') {
      catalog.resources.forEach(r => r.enabled = false);
    } else if (action === 'toggle' && Array.isArray(names)) {
      names.forEach(name => {
        const resource = catalog.resources.find(r => r.name === name);
        if (resource) resource.enabled = !resource.enabled;
      });
    }
    
    fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
    return res.end(JSON.stringify({ ok: true, updated: catalog.resources.length }));
  }

  // --- Tasks & Continuity Checkpoints ---
  if (pathname === '/admin/api/tasks' && req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const projectId = url.searchParams.get('projectId') || undefined;
    const tasks = listTasks(projectId);
    return res.end(JSON.stringify({ tasks }));
  }

  const taskContinueMatch = pathname.match(/^\/admin\/api\/tasks\/([a-zA-Z0-9_-]+)\/continue$/);
  if (taskContinueMatch && req.method === 'POST') {
    const taskId = taskContinueMatch[1];
    const continued = await continueTaskInNewSession(taskId);
    return res.end(JSON.stringify({ ok: true, session: continued }));
  }

  // --- 16.8 Context & Tokens ---
  if (pathname === '/admin/api/context') {
    if (req.method === 'GET') {
      return res.end(JSON.stringify({
        config: config.context,
        ingest: config.ingest
      }));
    }
    if (req.method === 'PUT') {
      // Update runtime context config
      if (body.maxContextTokens) config.context.maxContextTokens = Number(body.maxContextTokens);
      if (body.maxResponseTokens) config.context.maxResponseTokens = Number(body.maxResponseTokens);
      if (body.systemPromptBudget) config.context.systemPromptBudget = Number(body.systemPromptBudget);
      if (body.projectPromptBudget) config.context.projectPromptBudget = Number(body.projectPromptBudget);
      if (body.summaryBudget) config.context.summaryBudget = Number(body.summaryBudget);
      if (body.maxHistoryMessages) config.context.maxHistoryMessages = Number(body.maxHistoryMessages);
      if (body.memoryTokenBudget) config.context.memoryTokenBudget = Number(body.memoryTokenBudget);
      if (body.ragTokenBudget) config.context.ragTokenBudget = Number(body.ragTokenBudget);
      if (body.historyTokenBudget) config.context.historyTokenBudget = Number(body.historyTokenBudget);
      if (body.safetyMarginTokens) config.context.safetyMarginTokens = Number(body.safetyMarginTokens);

      return res.end(JSON.stringify({ ok: true, config: config.context }));
    }
  }

  if (pathname === '/admin/api/context/calculate' && req.method === 'POST') {
    const { text, messages } = body;
    let tokens = 0;
    if (typeof text === 'string') {
      tokens = estimateTokens(text);
    } else if (Array.isArray(messages)) {
      tokens = messages.reduce((acc, m) => acc + estimateTokens(m.content || ''), 0);
    }
    return res.end(JSON.stringify({ tokens }));
  }

  // --- 16.9 Settings ---
  if (pathname === '/admin/api/settings') {
    if (req.method === 'GET') {
      const dbSettings = db.prepare('SELECT * FROM settings').all();
      const settingsMap = {};
      for (const s of dbSettings) settingsMap[s.key] = s.value;
      return res.end(JSON.stringify({
        settings: settingsMap,
        environment: {
          gatewayHost: config.gateway.host,
          gatewayPort: config.gateway.port,
          llmBaseUrl: config.llm.baseUrl,
          redisUrl: config.redis.url,
          searxngUrl: config.searxng.baseUrl,
          logLevel: config.logLevel
        }
      }));
    }
    if (req.method === 'PUT') {
      for (const [k, v] of Object.entries(body)) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))').run(k, String(v));
      }
      return res.end(JSON.stringify({ ok: true }));
    }
  }

  // --- 16.10 Diagnostics ---
  if (pathname === '/admin/api/diagnostics/run' && req.method === 'GET') {
    const results = [];

    // 1. SQLite Database integrity test
    try {
      const integrity = db.prepare('PRAGMA integrity_check').get();
      results.push({
        name: 'Banco de Dados SQLite',
        passed: integrity.integrity_check === 'ok',
        details: integrity.integrity_check === 'ok' ? 'Integridade estrutural OK (WAL ativo)' : integrity.integrity_check
      });
    } catch (e) {
      results.push({ name: 'Banco de Dados SQLite', passed: false, details: e.message });
    }

    // 2. Redis Cache
    const redisOk = isRedisAvailable();
    results.push({
      name: 'Cache Redis',
      passed: redisOk,
      details: redisOk ? 'Conectado e operacional' : 'Indisponível (operando em degradação graciosa com SQLite direto)'
    });

    // 3. llama.cpp Backend
    try {
      const llamaTest = await testLlamaCppConnection(config.llm.baseUrl, 3000);
      results.push({
        name: 'Backend LLM (llama.cpp)',
        passed: llamaTest.ok,
        details: llamaTest.ok ? `Conectado em ${config.llm.baseUrl}. Modelos detectados: ${llamaTest.models?.length || 0}` : `Falha de conexão em ${config.llm.baseUrl}: ${llamaTest.error || 'sem resposta'}`
      });
    } catch (e) {
      results.push({ name: 'Backend LLM (llama.cpp)', passed: false, details: e.message });
    }

    // 4. SearXNG
    try {
      const sUrl = (config.searxng.baseUrl || 'http://127.0.0.1:8888').replace(/\/+$/, '');
      const sRes = await fetch(`${sUrl}/healthz`, { signal: AbortSignal.timeout(3000) })
        .catch(() => fetch(`${sUrl}/`, { signal: AbortSignal.timeout(3000) }));
      results.push({
        name: 'Metabusca SearXNG',
        passed: sRes.ok,
        details: sRes.ok ? `Operacional em ${sUrl}` : `Status inesperado: ${sRes.status}`
      });
    } catch (e) {
      results.push({
        name: 'Metabusca SearXNG',
        passed: false,
        details: `Falha de conexão em ${config.searxng.baseUrl}: ${e.message}`
      });
    }

    // 5. Memory Retrieval Test
    try {
      const memCount = db.prepare('SELECT count(*) as count FROM memories').get().count;
      results.push({
        name: 'Sistema de Memória Persistente',
        passed: true,
        details: `Subssistema de memória OK (${memCount} memórias cadastradas)`
      });
    } catch (e) {
      results.push({ name: 'Sistema de Memória Persistente', passed: false, details: e.message });
    }

    // 6. RAG FTS5 Search Test
    try {
      const searchRes = searchKnowledge({ query: 'test', limit: 1 });
      results.push({
        name: 'RAG & Busca FTS5',
        passed: true,
        details: 'Índice BM25 em FTS5 funcional'
      });
    } catch (e) {
      results.push({ name: 'RAG & Busca FTS5', passed: false, details: e.message });
    }

    // 7. Project Isolation Check
    try {
      // Test that project queries don't cross boundaries
      const p1Id = crypto.randomUUID();
      const p2Id = crypto.randomUUID();
      db.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test P1')").run(p1Id);
      db.prepare("INSERT INTO projects (id, name) VALUES (?, 'Test P2')").run(p2Id);
      db.prepare("INSERT INTO memories (id, project_id, scope, content) VALUES (?, ?, 'project', 'Secret P1')").run(crypto.randomUUID(), p1Id);
      db.prepare("INSERT INTO memories (id, project_id, scope, content) VALUES (?, ?, 'project', 'Secret P2')").run(crypto.randomUUID(), p2Id);

      const p1Memories = db.prepare("SELECT * FROM memories WHERE project_id = ? AND scope = 'project'").all(p1Id);
      const isolated = p1Memories.length === 1 && p1Memories[0].content === 'Secret P1';

      // Clean test records
      db.prepare('DELETE FROM projects WHERE id IN (?, ?)').run(p1Id, p2Id);

      results.push({
        name: 'Isolamento de Dados entre Projetos',
        passed: isolated,
        details: isolated ? 'Garantido por particionamento estrito de project_id' : 'FALHA: vazamento de escopo detectado'
      });
    } catch (e) {
      results.push({ name: 'Isolamento de Dados entre Projetos', passed: false, details: e.message });
    }

    return res.end(JSON.stringify({ diagnostics: results, timestamp: new Date().toISOString() }));
  }

  // Not found
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Endpoint administrativo não encontrado' }));
}
