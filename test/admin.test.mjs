// test/admin.test.mjs — Comprehensive test for all Admin Dashboard API endpoints

import test from 'node:test';
import assert from 'node:assert';
import { createGatewayServer } from '../gateway/server.mjs';
import { createSession } from '../gateway/auth.mjs';

test('Admin Dashboard API endpoints test suite', async () => {
  const server = createGatewayServer();
  const PORT = 8199;
  await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));

  const session = createSession('admin-test-id', 'admin');
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `localdevai_session=${session.token}`
  };

  const get = async (path) => {
    const res = await fetch(`http://127.0.0.1:${PORT}${path}`, { headers });
    return { status: res.status, json: await res.json() };
  };

  const post = async (path, body) => {
    const res = await fetch(`http://127.0.0.1:${PORT}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    return { status: res.status, json: await res.json() };
  };

  const del = async (path) => {
    const res = await fetch(`http://127.0.0.1:${PORT}${path}`, {
      method: 'DELETE',
      headers
    });
    return { status: res.status, json: await res.json() };
  };

  try {
    // 1. Dashboard Overview
    const dash = await get('/admin/api/dashboard');
    assert.strictEqual(dash.status, 200);
    assert.ok(dash.json.services, 'Dashboard deve conter serviços');
    assert.ok(dash.json.counts, 'Dashboard deve conter contadores');
    assert.ok(dash.json.services.database.connected, 'SQLite conectado');

    // 2. Projects CRUD
    const createP = await post('/admin/api/projects', { name: 'Projeto Teste API', description: 'Desc' });
    assert.strictEqual(createP.status, 201);
    const projId = createP.json.project.id;
    assert.ok(projId);

    const listP = await get('/admin/api/projects');
    assert.strictEqual(listP.status, 200);
    assert.ok(Array.isArray(listP.json.projects));

    // 3. Memory CRUD
    const createM = await post('/admin/api/memory', {
      content: 'Fato importante para IA',
      scope: 'project',
      projectId: projId
    });
    assert.strictEqual(createM.status, 201);
    const memId = createM.json.memory.id;

    const listM = await get('/admin/api/memory');
    assert.strictEqual(listM.status, 200);
    assert.ok(Array.isArray(listM.json.memories));

    // 4. Knowledge Sources
    const listK = await get('/admin/api/knowledge/sources');
    assert.strictEqual(listK.status, 200);
    assert.ok(Array.isArray(listK.json.sources));

    // 5. Context Token Calculator
    const calc = await post('/admin/api/context/calculate', { text: 'Construindo o painel administrativo' });
    assert.strictEqual(calc.status, 200);
    assert.ok(calc.json.tokens > 0);

    // 6. Tools List
    const tools = await get('/admin/api/tools');
    assert.strictEqual(tools.status, 200);
    assert.ok(Array.isArray(tools.json.tools));
    assert.ok(tools.json.tools.some(t => t.name === 'web_search'));

    // 7. Settings
    const settings = await get('/admin/api/settings');
    assert.strictEqual(settings.status, 200);
    assert.ok(settings.json.environment);

    // 8. Diagnostics
    const diag = await get('/admin/api/diagnostics/run');
    assert.strictEqual(diag.status, 200);
    assert.ok(Array.isArray(diag.json.diagnostics));
    assert.ok(diag.json.diagnostics.some(d => d.name === 'Banco de Dados SQLite'));

    // Cleanup
    await del(`/admin/api/memory/${memId}`);
    await del(`/admin/api/projects/${projId}`);

  } finally {
    server.close();
  }
});
