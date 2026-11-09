// gateway/server.mjs — HTTP Server handling API, Admin UI, and Routing

import http from 'node:http';
import { URL } from 'node:url';
import config from './config.mjs';
import logger from './logger.mjs';
import { validateApiKey } from './auth.mjs';
import { handleModelsRequest } from './api/models.mjs';
import { handleChatCompletions } from './api/chat.mjs';
import { handleAdminRouting } from './admin/router.mjs';

export function createGatewayServer() {
  const server = http.createServer(async (req, res) => {
    // Enable CORS for development and local clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-project-id, x-conversation-id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = parsedUrl.pathname;

    try {
      // 1. Health check
      if (pathname === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }));
      }

      // 2. Root redirect to /admin
      if (pathname === '/') {
        res.writeHead(302, { 'Location': '/admin' });
        return res.end();
      }

      // 3. Admin Panel UI & API (/admin and /admin/api/*)
      if (pathname.startsWith('/admin')) {
        const handled = await handleAdminRouting(req, res, pathname);
        if (handled !== false) return;
      }

      // 4. OpenAI API Key Validation (if configured)
      if (pathname.startsWith('/v1/')) {
        const authHeader = req.headers.authorization;
        if (!validateApiKey(authHeader)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: { message: 'Chave de API inválida ou ausente.', type: 'invalid_request_error' } }));
        }

        // 4.1 GET /v1/models
        if (pathname === '/v1/models' && req.method === 'GET') {
          return handleModelsRequest(req, res);
        }

        // 4.2 POST /v1/chat/completions
        if (pathname === '/v1/chat/completions' && req.method === 'POST') {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          let body = {};
          try {
            const text = Buffer.concat(chunks).toString();
            if (text) body = JSON.parse(text);
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: { message: 'JSON inválido no corpo da requisição.' } }));
          }
          return handleChatCompletions(req, res, body);
        }
      }

      // 5. Route Not Found
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Endpoint não encontrado', path: pathname }));

    } catch (err) {
      logger.error('Erro não tratado na requisição HTTP', { pathname, error: err.message, stack: err.stack });
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro interno no servidor gateway' }));
      }
    }
  });

  return server;
}
