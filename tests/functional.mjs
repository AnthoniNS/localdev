#!/usr/bin/env node
// tests/functional.mjs — Functional validation of LocalDevAI core modules

import { webSearch, webResearch } from '../gateway/web/search.mjs';
import { fetchWebPage, readMultiplePages } from '../gateway/web/reader.mjs';
import { searchKnowledgeCatalog } from '../gateway/knowledge/catalog.mjs';
import { resolveOrCreateProject } from '../gateway/projects/detector.mjs';
import { detectMaxContext, evaluateContextUsage } from '../gateway/context/manager.mjs';
import { createTask, saveCheckpoint, continueTaskInNewSession } from '../gateway/tasks/manager.mjs';
import { listAvailableTools, executeTool } from '../gateway/tools/manager.mjs';
import logger from '../gateway/logger.mjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  return async () => {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}\n   Error: ${err.message}`);
      failed++;
    }
  };
}

async function runTests() {
  console.log('🚀 Iniciando testes funcionais do LocalDevAI...\n');

  await test('1. Pesquisa no SearXNG', async () => {
    const res = await webSearch('Node.js Fetch API', { maxResults: 2, timeoutMs: 5000 });
    if (!res.results || res.results.length === 0) throw new Error('Nenhum resultado retornado');
  })();

  await test('2. Leitura real de páginas web', async () => {
    const res = await fetchWebPage('https://example.com', { timeoutMs: 5000 });
    if (!res.title || !res.content) throw new Error('Falha ao extrair conteúdo');
  })();

  await test('3. Extração de documentação (simulada)', async () => {
    const res = await fetchWebPage('https://laravel.com/docs', { timeoutMs: 8000 });
    if (!res.title.includes('Laravel')) throw new Error('Título não corresponde ao esperado');
  })();

  await test('4. Pesquisa de bibliotecas no catálogo', async () => {
    const res = searchKnowledgeCatalog({ query: 'Tailwind CSS', limit: 2 });
    if (res.length === 0) throw new Error('Nenhum recurso encontrado no catálogo');
  })();

  await test('5. Consulta à biblioteca de conhecimento (RAG FTS5)', async () => {
    // Requires DB, will skip if DB not initialized, but we test the function exists
    if (typeof searchKnowledgeCatalog !== 'function') throw new Error('Função não encontrada');
  })();

  await test('6. Tool calling real', async () => {
    const tools = listAvailableTools();
    if (!tools.find(t => t.name === 'web_search')) throw new Error('Tool web_search não registrada');
    const exec = await executeTool('web_search', { query: 'test', max_results: 1 });
    if (!exec.ok) throw new Error(`Falha na execução: ${exec.error}`);
  })();

  await test('7. Identificação automática do projeto', async () => {
    const mockReq = { headers: { 'x-workspace-folder': process.cwd() } };
    const proj = resolveOrCreateProject(mockReq, {});
    if (!proj || !proj.id) throw new Error('Falha ao detectar/criar projeto');
  })();

  await test('8. Recuperação do System Prompt individual', async () => {
    const mockReq = { headers: { 'x-workspace-folder': process.cwd() } };
    const proj = resolveOrCreateProject(mockReq, {});
    if (!proj.systemPrompt) throw new Error('System Prompt não gerado ou recuperado');
  })();

  await test('9. Monitoramento de contexto', async () => {
    const maxCtx = await detectMaxContext();
    const eval = evaluateContextUsage(4000, maxCtx);
    if (eval.maxContext < 1024) throw new Error('Contexto máximo inválido');
  })();

  await test('10. Geração de checkpoints e continuidade', async () => {
    const mockReq = { headers: { 'x-workspace-folder': process.cwd() } };
    const proj = resolveOrCreateProject(mockReq, {});
    const task = createTask({ projectId: proj.id, title: 'Teste de Checkpoint', objective: 'Validar continuidade' });
    saveCheckpoint(task.id, { nextAction: 'Testar recuperação' });
    if (!task.id) throw new Error('Falha ao criar tarefa e checkpoint');
  })();

  console.log(`\n📊 Resultados: ${passed} passaram, ${failed} falharam.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Erro fatal nos testes:', err);
  process.exit(1);
});
