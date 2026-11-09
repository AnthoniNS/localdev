// test/gateway.test.mjs — Integration tests for Gateway, Dashboard, Projects, Memory, and SSRF Guard

import test from 'node:test';
import assert from 'node:assert';
import { runMigrations } from '../gateway/db/migrations.mjs';
import { getDb } from '../gateway/db/connection.mjs';
import { ensureAdminUser, createSession, validateSession } from '../gateway/auth.mjs';
import { createProject, getProject, listProjects, deleteProject } from '../gateway/projects/manager.mjs';
import { createMemory, listMemories } from '../gateway/memory/manager.mjs';
import { validateUrl } from '../gateway/knowledge/ssrf.mjs';
import { createGatewayServer } from '../gateway/server.mjs';
import { estimateTokens } from '../gateway/context/tokens.mjs';

test('1. Database migrations and initial schema', () => {
  runMigrations();
  const db = getDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
  assert.ok(tables.includes('projects'), 'Tabela projects deve existir');
  assert.ok(tables.includes('conversations'), 'Tabela conversations deve existir');
  assert.ok(tables.includes('memories'), 'Tabela memories deve existir');
  assert.ok(tables.includes('knowledge_sources'), 'Tabela knowledge_sources deve existir');
  assert.ok(tables.includes('auth_users'), 'Tabela auth_users deve existir');
});

test('2. Admin user creation and session token verification', async () => {
  await ensureAdminUser();
  const session = createSession('test-admin-id', 'admin');
  assert.ok(session.token, 'Token de sessão deve ser gerado');
  
  const validated = validateSession(session.token);
  assert.ok(validated, 'Sessão válida deve ser reconhecida');
  assert.strictEqual(validated.userId, 'test-admin-id');
  assert.strictEqual(validated.role, 'admin');

  const invalid = validateSession('invalid.signature');
  assert.strictEqual(invalid, null, 'Assinatura inválida deve ser rejeitada sem crash');
});

test('3. Project creation and isolation', () => {
  const p1 = createProject({ name: 'Projeto Alpha', work_dir: '/tmp/alpha' });
  const p2 = createProject({ name: 'Projeto Beta', work_dir: '/tmp/beta' });

  assert.ok(p1.id, 'P1 deve ter ID');
  assert.ok(p2.id, 'P2 deve ter ID');
  assert.notStrictEqual(p1.id, p2.id, 'IDs devem ser distintos');

  createMemory({ projectId: p1.id, scope: 'project', content: 'Regra exclusiva Alpha' });
  createMemory({ projectId: p2.id, scope: 'project', content: 'Regra exclusiva Beta' });

  const m1 = listMemories({ projectId: p1.id, scope: 'project' });
  const m2 = listMemories({ projectId: p2.id, scope: 'project' });

  assert.strictEqual(m1.items.length, 1);
  assert.strictEqual(m1.items[0].content, 'Regra exclusiva Alpha');

  assert.strictEqual(m2.items.length, 1);
  assert.strictEqual(m2.items[0].content, 'Regra exclusiva Beta');

  deleteProject(p1.id);
  deleteProject(p2.id);
});

test('4. SSRF protection guard', async () => {
  const blockedLocal = await validateUrl('http://127.0.0.1:8080/admin');
  assert.strictEqual(blockedLocal.ok, false, '127.0.0.1 deve ser bloqueado para SSRF');

  const blockedPrivate = await validateUrl('http://192.168.1.1/router');
  assert.strictEqual(blockedPrivate.ok, false, 'IP privado deve ser bloqueado');

  const blockedLocalhost = await validateUrl('http://localhost:3000/api');
  assert.strictEqual(blockedLocalhost.ok, false, 'localhost deve ser bloqueado');

  const validPublic = await validateUrl('https://example.com/docs');
  assert.strictEqual(validPublic.ok, true, 'URL pública legítima deve ser aceita');
});

test('5. Token estimator consistency', () => {
  const tokensShort = estimateTokens('Hello world');
  assert.ok(tokensShort > 0, 'Tokens curtos calculados');

  const tokensLong = estimateTokens('A'.repeat(400));
  assert.ok(tokensLong >= 80, 'Tokens longos calculados de forma proporcional');
});

test('6. Server HTTP endpoints: /health, /admin, /v1/models', async () => {
  const server = createGatewayServer();
  await new Promise(resolve => server.listen(8198, '127.0.0.1', resolve));

  try {
    // Test /health
    const healthRes = await fetch('http://127.0.0.1:8198/health');
    assert.strictEqual(healthRes.status, 200);
    const healthJson = await healthRes.json();
    assert.strictEqual(healthJson.status, 'ok');

    // Test /admin (Serves HTML Dashboard)
    const adminRes = await fetch('http://127.0.0.1:8198/admin');
    assert.strictEqual(adminRes.status, 200);
    const adminHtml = await adminRes.text();
    assert.ok(adminHtml.includes('LocalDevAI — Painel Administrativo & Dashboard'), 'Dashboard HTML deve ser retornado');
    assert.ok(adminHtml.includes('Biblioteca RAG'), 'Seção de RAG deve estar presente');
    assert.ok(adminHtml.includes('Contexto & Tokens'), 'Seção de Contexto deve estar presente');

    // Test /v1/models
    const modelsRes = await fetch('http://127.0.0.1:8198/v1/models');
    assert.strictEqual(modelsRes.status, 200);
    const modelsJson = await modelsRes.json();
    assert.strictEqual(modelsJson.object, 'list');
    assert.ok(Array.isArray(modelsJson.data));

  } finally {
    server.close();
  }
});
