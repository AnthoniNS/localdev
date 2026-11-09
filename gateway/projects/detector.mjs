// gateway/projects/detector.mjs — Automatic workspace & project detection with individual system prompt preservation

import path from 'node:path';
import fs from 'node:fs';
import { getDb } from '../db/connection.mjs';
import { createProject, getProject, updateProject } from './manager.mjs';
import logger from '../logger.mjs';

/**
 * Detect tech stack from directory files
 */
function inspectProjectStack(workDir) {
  const languages = [];
  const frameworks = [];

  try {
    if (fs.existsSync(path.join(workDir, 'package.json'))) {
      languages.push('JavaScript', 'TypeScript');
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(workDir, 'package.json'), 'utf8'));
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if (deps.react) frameworks.push('React');
        if (deps.next) frameworks.push('Next.js');
        if (deps.vue) frameworks.push('Vue');
        if (deps.svelte) frameworks.push('Svelte');
        if (deps.express) frameworks.push('Express');
        if (deps.tailwindcss) frameworks.push('Tailwind CSS');
        if (deps.bootstrap) frameworks.push('Bootstrap');
      } catch {}
    }

    if (fs.existsSync(path.join(workDir, 'composer.json'))) {
      languages.push('PHP');
      try {
        const comp = JSON.parse(fs.readFileSync(path.join(workDir, 'composer.json'), 'utf8'));
        const reqs = { ...(comp.require || {}), ...(comp['require-dev'] || {}) };
        if (reqs['laravel/framework']) frameworks.push('Laravel');
        if (reqs['filament/filament']) frameworks.push('Filament');
        if (reqs['livewire/livewire']) frameworks.push('Livewire');
      } catch {}
    }

    if (fs.existsSync(path.join(workDir, 'pubspec.yaml'))) {
      languages.push('Dart');
      frameworks.push('Flutter');
    }

    if (fs.existsSync(path.join(workDir, 'requirements.txt')) || fs.existsSync(path.join(workDir, 'pyproject.toml'))) {
      languages.push('Python');
    }
  } catch (err) {
    logger.debug('Aviso ao inspecionar stack do projeto', { workDir, error: err.message });
  }

  return {
    languages: Array.from(new Set(languages)),
    frameworks: Array.from(new Set(frameworks))
  };
}

/**
 * Generate a specialized initial System Prompt based on detected stack
 */
function generateDefaultSystemPrompt(name, { languages, frameworks }) {
  const stackDesc = [...frameworks, ...languages].join(', ') || 'Desenvolvimento Geral';
  return `Você é o Engenheiro Sênior de Software responsável pelo projeto ${name}.
Especialidades deste projeto: ${stackDesc}.

DIRETRIZES DE ORGANIZAÇÃO DE PROJETOS:
- SEMPRE que for criar um novo projeto, aplicação ou experimento, PRIMEIRO use a ferramenta 'create_workspace' para criar uma pasta dedicada em workspaces/<nome-do-projeto>/
- Após criar o workspace, use o caminho retornado como base para todas as operações de arquivo subsequentes
- NUNCA crie arquivos diretamente na raiz do projeto principal
- Use nomes descritivos e em kebab-case para pastas de workspace (ex: "loja-eletrodomesticos", "app-react-todo")
- Cada projeto deve ter sua própria estrutura de pastas organizada

DIRETRIZES TÉCNICAS:
- Analisar a arquitetura e arquivos existentes antes de realizar modificações.
- Preservar padrões, convenções e código em funcionamento.
- Consultar a biblioteca de conhecimento e documentações oficiais para garantir compatibilidade.
- Implementar código completo e testável sem inventar métodos ou propriedades.`;
}

/**
 * Extract workspace folder from incoming HTTP request headers or body
 */
export function extractWorkspaceFromRequest(req, body = {}) {
  const headers = req?.headers || {};

  // 0. Detectar projeto via nome do modelo (formato: "projeto:nome-do-projeto")
  // Útil para clientes como Continue que não suportam headers customizados
  if (body.model && typeof body.model === 'string' && body.model.startsWith('projeto:')) {
    const projectName = body.model.replace('projeto:', '').trim();
    if (projectName) {
      const db = getDb();
      const projectRow = db.prepare('SELECT work_dir FROM projects WHERE name = ? AND state = ?').get(projectName, 'active');
      if (projectRow && projectRow.work_dir && fs.existsSync(projectRow.work_dir)) {
        logger.info('Projeto identificado via nome do modelo', { model: body.model, workDir: projectRow.work_dir });
        return path.resolve(projectRow.work_dir);
      }
      // Tentar buscar em workspaces/ também
      const workspacePath = path.join(process.cwd(), 'workspaces', projectName);
      if (fs.existsSync(workspacePath)) {
        logger.info('Workspace identificado via nome do modelo', { model: body.model, workDir: workspacePath });
        return workspacePath;
      }
    }
  }

  // 1. Check HTTP headers typically sent by VS Code / Continue / OpenCode / custom clients
  let bodyFolder = Array.isArray(body.workspaceFolders)
    ? body.workspaceFolders[0]
    : (body.workspaceFolder || body.workspace_folder || body.project_path || body.work_dir || body.cwd || body.projectPath);

  if (bodyFolder && typeof bodyFolder === 'object') {
    bodyFolder = bodyFolder.path || bodyFolder.fsPath || bodyFolder.uri || null;
  }
  if (typeof bodyFolder === 'string' && bodyFolder.startsWith('file://')) {
    try { bodyFolder = new URL(bodyFolder).pathname; } catch {}
  }

  const candidate = 
    headers['x-workspace-folder'] ||
    headers['x-vscode-workspace-folder'] ||
    headers['x-continue-project'] ||
    headers['x-opencode-project'] ||
    headers['x-client-project-path'] ||
    headers['x-project-path'] ||
    headers['x-cwd'] ||
    bodyFolder;

  if (candidate && typeof candidate === 'string' && candidate.trim()) {
    try {
      const resolved = path.resolve(candidate.trim());
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        return resolved;
      }
    } catch {}
  }

  // 2. Check explicit project ID
  const directProjectId = headers['x-project-id'] || body.project_id;
  if (directProjectId) {
    const existing = getProject(directProjectId);
    if (existing && existing.workDir && fs.existsSync(existing.workDir)) {
      return existing.workDir;
    }
  }

  // 3. Fallback to process cwd or LOCALDEVAI_PROJECT env
  if (process.env.LOCALDEVAI_PROJECT && fs.existsSync(process.env.LOCALDEVAI_PROJECT)) {
    return path.resolve(process.env.LOCALDEVAI_PROJECT);
  }

  return process.cwd();
}

/**
 * Automatically detect or create project in DB, ensuring the individual system prompt is loaded
 */
export function resolveOrCreateProject(req, body = {}) {
  const db = getDb();
  const directId = req?.headers?.['x-project-id'] || body?.project_id;

  // 1. If direct project ID matches existing project
  if (directId) {
    const proj = getProject(directId);
    if (proj) {
      setActiveProject(proj.id);
      return proj;
    }
  }

  // 2. Extract workspace directory
  const workDir = extractWorkspaceFromRequest(req, body);
  const normalizedPath = path.resolve(workDir);

  // 3. Search DB for project matching this work_dir
  const existingRow = db.prepare('SELECT * FROM projects WHERE work_dir = ?').get(normalizedPath);
  if (existingRow) {
    const proj = getProject(existingRow.id);
    setActiveProject(proj.id);
    return proj;
  }

  // 4. Also check if project name matches the folder basename
  const folderName = path.basename(normalizedPath) || 'LocalDevAI';
  const nameRow = db.prepare('SELECT * FROM projects WHERE name = ? AND work_dir = ?').get(folderName, normalizedPath);
  if (nameRow) {
    const proj = getProject(nameRow.id);
    setActiveProject(proj.id);
    return proj;
  }

  // 5. Not found — Automatically create project in DB
  const detectedStack = inspectProjectStack(normalizedPath);
  const initialSystemPrompt = generateDefaultSystemPrompt(folderName, detectedStack);

  const newProject = createProject({
    name: folderName,
    description: `Projeto detectado automaticamente em ${normalizedPath}`,
    workDir: normalizedPath,
    languages: detectedStack.languages,
    frameworks: detectedStack.frameworks,
    systemPrompt: initialSystemPrompt,
    memoryEnabled: true,
    ragEnabled: true
  });

  logger.info('Novo projeto cadastrado automaticamente pelo detector de workspace', {
    id: newProject.id,
    name: newProject.name,
    workDir: normalizedPath
  });

  setActiveProject(newProject.id);
  return newProject;
}

/**
 * Store the active project ID in settings
 */
export function setActiveProject(projectId) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES ('active_project_id', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `).run(projectId);
  } catch (err) {
    logger.debug('Falha ao persistir projeto ativo', { error: err.message });
  }
}

/**
 * Synchronize physical workspaces/ folders with the projects DB.
 * Called on gateway startup to register any orphaned workspaces.
 */
export function syncWorkspacesToProjects() {
  const workspacesRoot = path.join(process.cwd(), 'workspaces');
  if (!fs.existsSync(workspacesRoot)) return { synced: 0, skipped: 0 };

  const db = getDb();
  let synced = 0;
  let skipped = 0;

  try {
    const folders = fs.readdirSync(workspacesRoot, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);

    for (const folder of folders) {
      const workspacePath = path.join(workspacesRoot, folder);
      const existing = db.prepare('SELECT id FROM projects WHERE work_dir = ?').get(workspacePath);
      if (existing) {
        skipped++;
        continue;
      }

      try {
        const newProject = createProject({
          name: folder,
          description: `Workspace sincronizado automaticamente em ${workspacePath}`,
          workDir: workspacePath,
          languages: [],
          frameworks: [],
          systemPrompt: generateDefaultSystemPrompt(folder, { languages: [], frameworks: [] }),
          memoryEnabled: true,
          ragEnabled: true
        });
        logger.info('Workspace órfão registrado como projeto', { projectId: newProject.id, name: folder });
        synced++;
      } catch (err) {
        logger.warn('Falha ao registrar workspace órfão', { folder, error: err.message });
      }
    }
  } catch (err) {
    logger.warn('Falha ao sincronizar workspaces', { error: err.message });
  }

  return { synced, skipped };
}

/**
 * Get current active project
 */
export function getActiveProject() {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'active_project_id'").get();
    if (row && row.value) {
      const proj = getProject(row.value);
      if (proj && proj.state === 'active') return proj;
    }
    // Fallback: most recently updated active project
    const latest = db.prepare("SELECT id FROM projects WHERE state = 'active' ORDER BY updated_at DESC LIMIT 1").get();
    if (latest) {
      return getProject(latest.id);
    }
  } catch (err) {
    logger.debug('Erro ao obter projeto ativo', { error: err.message });
  }
  return null;
}
