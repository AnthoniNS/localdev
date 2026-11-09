// gateway/config.mjs — Centralized configuration loader
// All environment variables are validated and defaults applied here.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load .env file if present (simple parser, no dependency)
function loadDotenv() {
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  try {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Remove surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch { /* ignore */ }
}

loadDotenv();

function env(key, fallback = '') {
  return process.env[key] || fallback;
}

function envInt(key, fallback) {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

function envBool(key, fallback = false) {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes'].includes(v.toLowerCase());
}

const config = {
  root: ROOT,

  // Gateway
  gateway: {
    host: env('GATEWAY_HOST', '127.0.0.1'),
    port: envInt('GATEWAY_PORT', 8099),
  },

  // Auth
  auth: {
    adminPassword: env('ADMIN_PASSWORD', ''),
    apiKey: env('API_KEY', ''),
    sessionSecret: env('SESSION_SECRET', ''),
  },

  // LLM
  llm: {
    baseUrl: env('LLAMA_CPP_BASE_URL', 'http://127.0.0.1:8080/v1').replace(/\/+$/, ''),
    timeout: envInt('LLAMA_CPP_TIMEOUT', 300000),
    defaultModel: env('DEFAULT_MODEL', 'local-model'),
  },

  // Redis
  redis: {
    url: env('REDIS_URL', 'redis://127.0.0.1:6379'),
    prefix: env('REDIS_PREFIX', 'localdevai:'),
  },

  // SearXNG
  searxng: {
    baseUrl: env('SEARXNG_BASE_URL', 'http://127.0.0.1:8888').replace(/\/+$/, ''),
  },

  // Database
  db: {
    path: path.resolve(ROOT, env('DB_PATH', './data/localdevai.db')),
  },

  // Data
  dataDir: path.resolve(ROOT, env('DATA_DIR', './data')),
  logDir: path.resolve(ROOT, env('LOG_DIR', './data/logs')),

  // Context
  context: {
    maxContextTokens: envInt('MAX_CONTEXT_TOKENS', 8192),
    maxResponseTokens: envInt('MAX_RESPONSE_TOKENS', 2048),
    systemPromptBudget: envInt('SYSTEM_PROMPT_BUDGET', 500),
    projectPromptBudget: envInt('PROJECT_PROMPT_BUDGET', 300),
    summaryBudget: envInt('SUMMARY_BUDGET', 400),
    maxHistoryMessages: envInt('MAX_HISTORY_MESSAGES', 20),
    maxMemoriesPerRequest: envInt('MAX_MEMORIES_PER_REQUEST', 10),
    memoryTokenBudget: envInt('MEMORY_TOKEN_BUDGET', 800),
    ragTokenBudget: envInt('RAG_TOKEN_BUDGET', 1200),
    historyTokenBudget: envInt('HISTORY_TOKEN_BUDGET', 2000),
    safetyMarginTokens: envInt('SAFETY_MARGIN_TOKENS', 200),
  },

  // Knowledge ingestion
  ingest: {
    maxPageSize: envInt('INGEST_MAX_PAGE_SIZE', 2_000_000),
    timeout: envInt('INGEST_TIMEOUT', 30000),
    maxConcurrent: envInt('INGEST_MAX_CONCURRENT', 2),
    maxCrawlDepth: envInt('INGEST_MAX_CRAWL_DEPTH', 3),
    maxPagesPerSource: envInt('INGEST_MAX_PAGES_PER_SOURCE', 50),
    chunkSize: envInt('CHUNK_SIZE', 500),
    chunkOverlap: envInt('CHUNK_OVERLAP', 50),
  },

  // Rate limiting
  rateLimit: {
    window: envInt('RATE_LIMIT_WINDOW', 60000),
    max: envInt('RATE_LIMIT_MAX', 60),
  },

  // Logging
  logLevel: env('LOG_LEVEL', 'info'),

  // MCP
  mcp: {
    serverPath: path.resolve(ROOT, env('MCP_SERVER_PATH', './mcp/server.mjs')),
  },
};

// Validate critical settings
const errors = [];
if (config.gateway.port < 1 || config.gateway.port > 65535) {
  errors.push('GATEWAY_PORT must be between 1 and 65535');
}
if (config.context.maxContextTokens < 1024) {
  errors.push('MAX_CONTEXT_TOKENS must be at least 1024');
}
if (config.context.maxResponseTokens >= config.context.maxContextTokens) {
  errors.push('MAX_RESPONSE_TOKENS must be less than MAX_CONTEXT_TOKENS');
}

if (errors.length > 0) {
  console.error('Configuration errors:');
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
}

export default config;
