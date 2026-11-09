// gateway/db/migrations.mjs — Versioned database migrations

import { getDb } from './connection.mjs';
import logger from '../logger.mjs';

const MIGRATIONS = [
  {
    version: 1,
    name: 'initial_schema',
    up: `
      -- Migration tracking
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Projects
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        work_dir TEXT DEFAULT '',
        languages TEXT DEFAULT '[]',
        frameworks TEXT DEFAULT '[]',
        default_model TEXT DEFAULT '',
        context_config TEXT DEFAULT '{}',
        memory_enabled INTEGER DEFAULT 1,
        rag_enabled INTEGER DEFAULT 1,
        system_prompt TEXT DEFAULT '',
        state TEXT DEFAULT 'active' CHECK(state IN ('active', 'archived')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Conversations
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT DEFAULT 'New Conversation',
        model TEXT DEFAULT '',
        state TEXT DEFAULT 'active' CHECK(state IN ('active', 'archived')),
        total_tokens_in INTEGER DEFAULT 0,
        total_tokens_out INTEGER DEFAULT 0,
        message_count INTEGER DEFAULT 0,
        summary TEXT DEFAULT '',
        summary_updated_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id);

      -- Messages
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('system', 'user', 'assistant', 'tool')),
        content TEXT NOT NULL,
        name TEXT,
        tool_calls TEXT,
        tool_call_id TEXT,
        tokens_estimated INTEGER DEFAULT 0,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id);

      -- Memories
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        conversation_id TEXT,
        scope TEXT NOT NULL CHECK(scope IN ('conversation', 'project', 'global')),
        type TEXT DEFAULT 'fact',
        content TEXT NOT NULL,
        priority INTEGER DEFAULT 5 CHECK(priority BETWEEN 1 AND 10),
        usage_count INTEGER DEFAULT 0,
        last_used_at TEXT,
        expires_at TEXT,
        state TEXT DEFAULT 'active' CHECK(state IN ('active', 'archived')),
        origin TEXT DEFAULT 'manual',
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id, scope, state);
      CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope, state);

      -- Knowledge Sources
      CREATE TABLE IF NOT EXISTS knowledge_sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        description TEXT DEFAULT '',
        category TEXT DEFAULT '',
        subcategory TEXT DEFAULT '',
        source_type TEXT DEFAULT 'documentation',
        scope TEXT NOT NULL DEFAULT 'global' CHECK(scope IN ('global', 'project')),
        project_id TEXT,
        language TEXT DEFAULT 'en',
        tags TEXT DEFAULT '[]',
        priority INTEGER DEFAULT 5 CHECK(priority BETWEEN 1 AND 10),
        enabled INTEGER DEFAULT 1,
        crawl_mode TEXT DEFAULT 'single' CHECK(crawl_mode IN ('single', 'sitemap', 'crawl')),
        crawl_depth INTEGER DEFAULT 1,
        refresh_interval INTEGER DEFAULT 0,
        last_crawled_at TEXT,
        last_success_at TEXT,
        last_error TEXT,
        content_hash TEXT,
        version INTEGER DEFAULT 0,
        doc_count INTEGER DEFAULT 0,
        chunk_count INTEGER DEFAULT 0,
        state TEXT DEFAULT 'pending' CHECK(state IN ('pending', 'processing', 'ready', 'error', 'paused')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_knowledge_sources_scope ON knowledge_sources(scope, enabled);
      CREATE INDEX IF NOT EXISTS idx_knowledge_sources_project ON knowledge_sources(project_id);

      -- Knowledge Documents (pages discovered from a source)
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT DEFAULT '',
        content_hash TEXT,
        content_length INTEGER DEFAULT 0,
        version INTEGER DEFAULT 0,
        state TEXT DEFAULT 'pending' CHECK(state IN ('pending', 'processing', 'ready', 'error')),
        last_error TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (source_id) REFERENCES knowledge_sources(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_knowledge_documents_source ON knowledge_documents(source_id);

      -- Knowledge Chunks (fragments for search)
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        project_id TEXT,
        scope TEXT NOT NULL DEFAULT 'global',
        title TEXT DEFAULT '',
        content TEXT NOT NULL,
        position INTEGER DEFAULT 0,
        token_estimate INTEGER DEFAULT 0,
        version INTEGER DEFAULT 0,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (source_id) REFERENCES knowledge_sources(id) ON DELETE CASCADE,
        FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source ON knowledge_chunks(source_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document ON knowledge_chunks(document_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_scope ON knowledge_chunks(scope, project_id);

      -- FTS5 virtual table for full-text search on chunks
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts USING fts5(
        title,
        content,
        content=knowledge_chunks,
        content_rowid=rowid,
        tokenize='porter unicode61'
      );

      -- Triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS knowledge_chunks_ai AFTER INSERT ON knowledge_chunks BEGIN
        INSERT INTO knowledge_chunks_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
      END;
      CREATE TRIGGER IF NOT EXISTS knowledge_chunks_ad AFTER DELETE ON knowledge_chunks BEGIN
        INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content);
      END;
      CREATE TRIGGER IF NOT EXISTS knowledge_chunks_au AFTER UPDATE ON knowledge_chunks BEGIN
        INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content);
        INSERT INTO knowledge_chunks_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
      END;

      -- Ingestion history
      CREATE TABLE IF NOT EXISTS ingestion_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        docs_processed INTEGER DEFAULT 0,
        chunks_created INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        error TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (source_id) REFERENCES knowledge_sources(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_ingestion_log_source ON ingestion_log(source_id, created_at);

      -- Model configurations
      CREATE TABLE IF NOT EXISTS models (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        display_name TEXT DEFAULT '',
        endpoint TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        max_context INTEGER DEFAULT 8192,
        max_response INTEGER DEFAULT 2048,
        timeout INTEGER DEFAULT 120000,
        capabilities TEXT DEFAULT '[]',
        enabled INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- System settings (key-value)
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Tool execution log
      CREATE TABLE IF NOT EXISTS tool_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT,
        project_id TEXT,
        tool_name TEXT NOT NULL,
        input TEXT,
        output TEXT,
        status TEXT NOT NULL DEFAULT 'success',
        duration_ms INTEGER DEFAULT 0,
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_tool_log_conversation ON tool_log(conversation_id, created_at);

      -- Auth (admin user)
      CREATE TABLE IF NOT EXISTS auth_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    version: 2,
    name: 'tasks_checkpoints_web_cache',
    up: `
      -- Autonomous Tasks
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        objective TEXT DEFAULT '',
        state TEXT DEFAULT 'in_progress' CHECK(state IN ('in_progress', 'completed', 'paused', 'failed')),
        current_session_id TEXT,
        session_count INTEGER DEFAULT 1,
        progress_pct INTEGER DEFAULT 0,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id, state);

      -- Task Checkpoints
      CREATE TABLE IF NOT EXISTS task_checkpoints (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        session_id TEXT,
        checkpoint_index INTEGER DEFAULT 1,
        objective TEXT DEFAULT '',
        completed_steps TEXT DEFAULT '[]',
        pending_steps TEXT DEFAULT '[]',
        files_created TEXT DEFAULT '[]',
        files_modified TEXT DEFAULT '[]',
        technical_decisions TEXT DEFAULT '[]',
        errors_encountered TEXT DEFAULT '[]',
        test_results TEXT DEFAULT '[]',
        next_action TEXT DEFAULT '',
        context_token_usage INTEGER DEFAULT 0,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_checkpoints_task ON task_checkpoints(task_id, checkpoint_index);

      -- Web Reader & Search Cache
      CREATE TABLE IF NOT EXISTS web_cache (
        url_hash TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        title TEXT DEFAULT '',
        description TEXT DEFAULT '',
        content TEXT NOT NULL,
        status_code INTEGER DEFAULT 200,
        content_type TEXT DEFAULT 'text/html',
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_web_cache_expires ON web_cache(expires_at);

      -- Add task_id and session_index to conversations if not existing
      -- SQLite 3.35+ allows ALTER TABLE ADD COLUMN
      PRAGMA foreign_keys = OFF;
      CREATE TABLE IF NOT EXISTS _conv_cols (name TEXT);
    `,
  },
];

export function runMigrations() {
  const db = getDb();

  // Ensure migrations table exists
  db.exec(`CREATE TABLE IF NOT EXISTS migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const applied = new Set(
    db.prepare('SELECT version FROM migrations').all().map(r => r.version)
  );

  const pending = MIGRATIONS.filter(m => !applied.has(m.version))
    .sort((a, b) => a.version - b.version);

  if (pending.length === 0) {
    logger.info('Database schema is up to date');
    return;
  }

  for (const migration of pending) {
    logger.info(`Running migration ${migration.version}: ${migration.name}`);
    const run = db.transaction(() => {
      db.exec(migration.up);

      // Ensure conversations has task_id and session_index
      try {
        const convInfo = db.prepare("PRAGMA table_info(conversations)").all();
        const convCols = new Set(convInfo.map(c => c.name));
        if (!convCols.has('task_id')) {
          db.exec("ALTER TABLE conversations ADD COLUMN task_id TEXT;");
        }
        if (!convCols.has('session_index')) {
          db.exec("ALTER TABLE conversations ADD COLUMN session_index INTEGER DEFAULT 1;");
        }
      } catch (colErr) {
        logger.warn('Aviso ao verificar colunas de conversations', { error: colErr.message });
      }

      db.prepare('INSERT OR IGNORE INTO migrations (version, name) VALUES (?, ?)').run(
        migration.version, migration.name
      );
    });
    run();
    logger.info(`Migration ${migration.version} applied`);
  }
}
