// gateway/tools/manager.mjs — Tools registration and real execution management

import path from 'node:path';
import fs from 'node:fs/promises';
import { getDb } from '../db/connection.mjs';
import config from '../config.mjs';
import logger from '../logger.mjs';
import { createProject } from '../projects/manager.mjs';
import { webSearch, webResearch } from '../web/search.mjs';
import { fetchWebPage, readMultiplePages } from '../web/reader.mjs';
import { searchImages, searchProductImages, searchStockImages } from '../web/image-search.mjs';
import { searchKnowledgeCatalog, formatCatalogResults } from '../knowledge/catalog.mjs';
import { searchKnowledge } from '../knowledge/search.mjs';

const REGISTERED_TOOLS = [
  {
    name: 'web_search',
    description: 'Busca na web via SearXNG. Retorna títulos, URLs e snippets.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Termo de busca' },
        language: { type: 'string', default: 'pt-BR' },
        max_results: { type: 'integer', default: 5 }
      },
      required: ['query']
    }
  },
  {
    name: 'web_fetch',
    description: 'Lê uma URL e extrai o conteúdo principal limpo (sem menus/ads).',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL HTTP/HTTPS' },
        max_length: { type: 'integer', default: 12000 }
      },
      required: ['url']
    }
  },
  {
    name: 'web_research',
    description: 'Pesquisa e lê as melhores páginas sobre um tópico, com citações.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        max_results: { type: 'integer', default: 3 },
        language: { type: 'string', default: 'pt-BR' }
      },
      required: ['query']
    }
  },
  {
    name: 'web_read_multiple',
    description: 'Lê várias URLs em uma chamada, com cache e falhas individuais.',
    parameters: {
      type: 'object',
      properties: {
        urls: { type: 'array', items: { type: 'string' } },
        max_concurrent: { type: 'integer', default: 3 }
      },
      required: ['urls']
    }
  },
  {
    name: 'image_search',
    description: 'Busca imagens reais na web. Retorna URLs, resoluções e fontes. Use para fotos reais, nunca ícones.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        max_results: { type: 'integer', default: 5 },
        size_filter: { type: 'string', enum: ['large', 'medium', 'small', 'icon', ''] },
        type_filter: { type: 'string', enum: ['photo', 'clipart', 'face', 'lineart', ''] }
      },
      required: ['query']
    }
  },
  {
    name: 'product_image_search',
    description: 'Busca fotos reais de produtos para e-commerce. Prioriza fotos grandes.',
    parameters: {
      type: 'object',
      properties: {
        product_name: { type: 'string' },
        category: { type: 'string' },
        max_results: { type: 'integer', default: 5 }
      },
      required: ['product_name']
    }
  },
  {
    name: 'stock_image_search',
    description: 'Busca imagens stock profissionais para layouts e banners.',
    parameters: {
      type: 'object',
      properties: {
        concept: { type: 'string' },
        style: { type: 'string', default: 'photo' },
        max_results: { type: 'integer', default: 5 }
      },
      required: ['concept']
    }
  },
  {
    name: 'knowledge_search',
    description: 'Consulta a biblioteca técnica local (159 recursos) antes de buscar na web. Retorna docs e CDNs.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        category: { type: 'string' },
        limit: { type: 'integer', default: 5 }
      },
      required: ['query']
    }
  },
  {
    name: 'project_search',
    description: 'Busca texto ou arquivos no projeto.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        relative_path: { type: 'string', default: '.' },
        max_matches: { type: 'integer', default: 30 }
      },
      required: ['query']
    }
  },
  {
    name: 'list_project_files',
    description: 'Lista arquivos do workspace.',
    parameters: {
      type: 'object',
      properties: {
        relative_path: { type: 'string', default: '.' },
        max_entries: { type: 'integer', default: 100 }
      }
    }
  },
  {
    name: 'read_project_file',
    description: 'Lê o conteúdo de um arquivo do projeto.',
    parameters: {
      type: 'object',
      properties: {
        relative_path: { type: 'string' }
      },
      required: ['relative_path']
    }
  },
  {
    name: 'write_project_file',
    description: 'Cria ou atualiza um arquivo no workspace com o conteúdo fornecido.',
    parameters: {
      type: 'object',
      properties: {
        relative_path: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['relative_path', 'content']
    }
  },
  {
    name: 'create_workspace',
    description: 'Cria pasta isolada em workspaces/ para um novo projeto. Use sempre ao iniciar projeto novo. Retorna o caminho criado.',
    parameters: {
      type: 'object',
      properties: {
        project_name: { type: 'string', description: 'Nome kebab-case, ex: loja-eletrodomesticos' },
        description: { type: 'string' }
      },
      required: ['project_name']
    }
  }
];

export function listAvailableTools() {
  return REGISTERED_TOOLS;
}

/**
 * Log tool execution in database
 */
export function logToolExecution({ conversationId = null, projectId = null, toolName, input, output, status, durationMs, error = null }) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO tool_log (conversation_id, project_id, tool_name, input, output, status, duration_ms, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      conversationId,
      projectId,
      toolName,
      typeof input === 'string' ? input : JSON.stringify(input),
      typeof output === 'string' ? output : JSON.stringify(output),
      status,
      durationMs,
      error
    );
  } catch (err) {
    logger.warn('Falha ao registrar log de execução de ferramenta', { error: err.message });
  }
}

/**
 * Get recent tool execution logs
 */
export function getToolExecutionLogs(limit = 50, projectId = null) {
  const db = getDb();
  if (projectId) {
    return db.prepare('SELECT * FROM tool_log WHERE project_id = ? ORDER BY created_at DESC LIMIT ?').all(projectId, limit);
  }
  return db.prepare('SELECT * FROM tool_log ORDER BY created_at DESC LIMIT ?').all(limit);
}

/**
 * Validate that a path stays inside the project's root folder
 */
export function validateProjectPath(workDir, relativePath) {
  if (!workDir) {
    throw new Error('Nenhum diretório de trabalho foi configurado para este projeto.');
  }
  const resolvedRoot = path.resolve(workDir);
  const resolvedTarget = path.resolve(resolvedRoot, relativePath || '.');
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    throw new Error('Acesso negado: o caminho especificado está fora do diretório do projeto.');
  }
  return resolvedTarget;
}

/**
 * Real execution of tools on behalf of LLM or Gateway
 */
export async function executeTool(toolName, args = {}, options = {}) {
  const startTime = Date.now();
  const { projectId = null, conversationId = null, workDir = process.cwd() } = options;

  try {
    let result;

    if (toolName === 'web_search') {
      const searchRes = await webSearch(args.query, {
        language: args.language || 'pt-BR',
        maxResults: args.max_results || 5
      });
      result = searchRes;

    } else if (toolName === 'web_fetch') {
      const page = await fetchWebPage(args.url, {
        maxContentLength: args.max_length || 12000,
        useCache: true,
        enableJsFallback: true
      });
      result = {
        url: page.url,
        title: page.title,
        description: page.description,
        content: page.content,
        fromCache: page.fromCache || false
      };

    } else if (toolName === 'web_research') {
      const researchRes = await webResearch(args.query, {
        maxResults: args.max_results || 3,
        language: args.language || 'pt-BR'
      });
      result = researchRes;

    } else if (toolName === 'web_read_multiple') {
      const multi = await readMultiplePages(args.urls || [], {
        maxConcurrent: args.max_concurrent || 3,
        useCache: true
      });
      result = { pagesCount: multi.length, pages: multi };

    } else if (toolName === 'image_search') {
      const imgRes = await searchImages(args.query, {
        maxResults: args.max_results || 5,
        sizeFilter: args.size_filter || '',
        typeFilter: args.type_filter || ''
      });
      result = imgRes;

    } else if (toolName === 'product_image_search') {
      const prodImgRes = await searchProductImages(args.product_name, {
        category: args.category || '',
        maxResults: args.max_results || 5
      });
      result = prodImgRes;

    } else if (toolName === 'stock_image_search') {
      const stockImgRes = await searchStockImages(args.concept, {
        style: args.style || 'photo',
        maxResults: args.max_results || 5
      });
      result = stockImgRes;

    } else if (toolName === 'knowledge_search') {
      const catalogResults = searchKnowledgeCatalog({
        query: args.query,
        category: args.category,
        limit: args.limit || 5
      });

      // Also search RAG FTS5 if project specified
      let ragResults = [];
      try {
        if (projectId) {
          const rag = searchKnowledge({ query: args.query, projectId, maxChunks: 3 });
          ragResults = rag.chunks || [];
        }
      } catch {}

      result = {
        query: args.query,
        catalogCount: catalogResults.length,
        catalog: catalogResults,
        formattedCatalog: formatCatalogResults(catalogResults),
        ragChunksCount: ragResults.length,
        ragChunks: ragResults.map(c => ({ title: c.title, content: c.content }))
      };

    } else if (toolName === 'project_search' || toolName === 'search_project_text') {
      const targetDir = validateProjectPath(workDir, args.relative_path || '.');
      const query = (args.query || '').toLowerCase();
      const maxMatches = Math.min(args.max_matches || 30, 80);
      const matches = [];
      const ignored = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '.venv', 'vendor']);

      async function searchDir(dir, depth) {
        if (depth > 5 || matches.length >= maxMatches) return;
        let dirents;
        try { dirents = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
        for (const ent of dirents) {
          if (ignored.has(ent.name) || ent.name.startsWith('.env')) continue;
          const full = path.join(dir, ent.name);
          if (ent.isDirectory()) {
            await searchDir(full, depth + 1);
          } else {
            try {
              const stat = await fs.stat(full);
              if (stat.size > 250_000) continue;
              const text = await fs.readFile(full, 'utf8');
              const lines = text.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes(query)) {
                  matches.push({
                    file: path.relative(path.resolve(workDir), full),
                    line: i + 1,
                    text: lines[i].trim().slice(0, 300)
                  });
                  if (matches.length >= maxMatches) break;
                }
              }
            } catch {}
          }
          if (matches.length >= maxMatches) break;
        }
      }
      await searchDir(targetDir, 0);
      result = { query: args.query, matchesCount: matches.length, matches };

    } else if (toolName === 'list_project_files') {
      const targetDir = validateProjectPath(workDir, args.relative_path || '.');
      const maxEntries = Math.min(args.max_entries || 100, 200);
      const ignored = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '.venv', 'vendor']);
      const entries = [];

      async function walk(current, depth) {
        if (depth > 4 || entries.length >= maxEntries) return;
        let dirents;
        try { dirents = await fs.readdir(current, { withFileTypes: true }); } catch { return; }
        for (const ent of dirents) {
          if (ignored.has(ent.name) || ent.name.startsWith('.env')) continue;
          const full = path.join(current, ent.name);
          const rel = path.relative(path.resolve(workDir), full);
          entries.push(`${ent.isDirectory() ? '[DIR] ' : '[FILE] '}${rel}`);
          if (ent.isDirectory() && entries.length < maxEntries) {
            await walk(full, depth + 1);
          }
          if (entries.length >= maxEntries) break;
        }
      }
      await walk(targetDir, 0);
      result = { count: entries.length, files: entries };

    } else if (toolName === 'read_project_file') {
      const targetFile = validateProjectPath(workDir, args.relative_path);
      const stat = await fs.stat(targetFile);
      if (!stat.isFile()) throw new Error('O caminho especificado não é um arquivo regular.');
      if (stat.size > 300_000) throw new Error('Arquivo excede o limite máximo permitido de 300 KB.');
      const content = await fs.readFile(targetFile, 'utf8');
      result = { file: args.relative_path, size: stat.size, content };

    } else if (toolName === 'write_project_file') {
      const targetFile = validateProjectPath(workDir, args.relative_path);
      await fs.mkdir(path.dirname(targetFile), { recursive: true });
      await fs.writeFile(targetFile, args.content || '', 'utf8');
      const stat = await fs.stat(targetFile);
      result = { ok: true, file: args.relative_path, bytesWritten: stat.size };

    } else if (toolName === 'create_workspace') {
      const projectName = args.project_name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      const workspacesRoot = path.join(process.cwd(), 'workspaces');
      const workspacePath = path.join(workspacesRoot, projectName);
      
      await fs.mkdir(workspacesRoot, { recursive: true });
      await fs.mkdir(workspacePath, { recursive: true });
      
      const readme = `# ${args.project_name}\n\n${args.description || 'Projeto criado pelo LocalDevAI'}\n\nCriado em: ${new Date().toISOString()}\n`;
      await fs.writeFile(path.join(workspacePath, 'README.md'), readme, 'utf8');
      
      // Registrar o workspace como projeto no banco para aparecer no painel
      let registeredProjectId = null;
      try {
        const db = getDb();
        const existing = db.prepare('SELECT id FROM projects WHERE work_dir = ?').get(workspacePath);
        if (existing) {
          registeredProjectId = existing.id;
        } else {
          const newProject = createProject({
            name: projectName,
            description: args.description || `Projeto criado automaticamente pelo LocalDevAI em ${workspacePath}`,
            workDir: workspacePath,
            languages: [],
            frameworks: [],
            systemPrompt: `Você é o Engenheiro Sênior de Software responsável pelo projeto ${projectName}.\nDiretrizes:\n- Analisar a arquitetura e arquivos existentes antes de realizar modificações.\n- Preservar padrões, convenções e código em funcionamento.\n- Consultar a biblioteca de conhecimento antes de buscar na web.\n- Implementar código completo e testável sem inventar métodos ou propriedades.`,
            memoryEnabled: true,
            ragEnabled: true
          });
          registeredProjectId = newProject.id;
          logger.info('Workspace registrado como projeto no painel', { projectId: newProject.id, name: projectName, workDir: workspacePath });
        }
      } catch (regErr) {
        logger.warn('Falha ao registrar workspace como projeto', { error: regErr.message });
      }
      
      result = {
        ok: true,
        workspace_name: projectName,
        workspace_path: workspacePath,
        project_id: registeredProjectId,
        message: `Workspace criado com sucesso em ${workspacePath} e registrado como projeto. Use este caminho como workDir para operações subsequentes.`
      };

    } else {
      throw new Error(`Ferramenta desconhecida: ${toolName}`);
    }

    const duration = Date.now() - startTime;
    logToolExecution({
      conversationId,
      projectId,
      toolName,
      input: args,
      output: result,
      status: 'success',
      durationMs: duration
    });
    return { ok: true, result, durationMs: duration };

  } catch (err) {
    const duration = Date.now() - startTime;
    logToolExecution({
      conversationId,
      projectId,
      toolName,
      input: args,
      output: null,
      status: 'error',
      durationMs: duration,
      error: err.message
    });
    return { ok: false, error: err.message, durationMs: duration };
  }
}
