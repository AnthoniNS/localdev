// gateway/index.mjs — Gateway Entry Point

import config from './config.mjs';
import logger from './logger.mjs';
import { runMigrations } from './db/migrations.mjs';
import { closeDb } from './db/connection.mjs';
import { ensureAdminUser } from './auth.mjs';
import { connectRedis, closeRedis } from './redis/client.mjs';
import { createGatewayServer } from './server.mjs';
import { syncWorkspacesToProjects } from './projects/detector.mjs';

async function main() {
  console.log('\n🚀 Iniciando LocalDevAI Gateway...\n');

  try {
    // 1. Database migrations
    runMigrations();

    // 2. Ensure admin credentials
    await ensureAdminUser();

    // 3. Connect Redis (graceful degradation if offline)
    await connectRedis();

    // 4. Synchronize physical workspaces/ folders with projects DB
    try {
      const syncResult = syncWorkspacesToProjects();
      if (syncResult.synced > 0) {
        logger.info('Workspaces órfãos registrados como projetos', syncResult);
      }
    } catch (err) {
      logger.warn('Falha na sincronização de workspaces (non-fatal)', { error: err.message });
    }

    // 5. Start HTTP Server
    const server = createGatewayServer();
    const host = config.gateway.host;
    const port = config.gateway.port;

    server.listen(port, host, () => {
      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log('║               LocalDevAI Gateway Operacional                 ║');
      console.log('╠══════════════════════════════════════════════════════════════╣');
      console.log(`║  🌐 Painel Admin & Dashboard: http://${host}:${port}/admin`.padEnd(63) + '║');
      console.log(`║  🤖 API OpenAI Compatível:    http://${host}:${port}/v1`.padEnd(63) + '║');
      console.log(`║  🩺 Health Check:             http://${host}:${port}/health`.padEnd(63) + '║');
      console.log(`║  🔍 SearXNG Metabusca:        ${config.searxng.baseUrl}`.padEnd(63) + '║');
      console.log(`║  🧠 llama.cpp Backend:        ${config.llm.baseUrl}`.padEnd(63) + '║');
      console.log('╚══════════════════════════════════════════════════════════════╝\n');
      logger.info('Gateway iniciado com sucesso', { host, port });
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\nRecebido ${signal}, encerrando LocalDevAI Gateway...`);
      server.close();
      await closeRedis();
      closeDb();
      console.log('Serviços finalizados com sucesso.');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (err) {
    logger.error('Falha fatal na inicialização do Gateway', { error: err.message, stack: err.stack });
    console.error('ERRO FATAL:', err);
    process.exit(1);
  }
}

main();
