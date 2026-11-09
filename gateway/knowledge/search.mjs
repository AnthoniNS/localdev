// gateway/knowledge/search.mjs — BM25 full-text search on knowledge chunks via SQLite FTS5

import { getDb } from '../db/connection.mjs';
import logger from '../logger.mjs';
import { estimateTokens } from '../context/tokens.mjs';
import { redisGetJson, redisSetJson } from '../redis/client.mjs';

/**
 * Search knowledge chunks using FTS5 BM25 ranking.
 * Respects scope isolation.
 */
export function searchKnowledge({ query, projectId, scope, maxChunks = 10, maxTokens = 1200 }) {
  const db = getDb();

  if (!query || query.trim().length < 2) return { chunks: [], totalTokens: 0 };

  // Sanitize FTS5 query — escape special characters
  const ftsQuery = query
    .replace(/["\-*(){}[\]^~:]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1)
    .map(t => `"${t}"`)
    .join(' OR ');

  if (!ftsQuery) return { chunks: [], totalTokens: 0 };

  // Build scope filter
  let scopeCondition = '';
  const params = [];

  if (scope === 'conversation' || scope === 'project') {
    // Project-scoped: include project chunks + global chunks
    if (projectId) {
      scopeCondition = "AND (kc.project_id = ? OR kc.scope = 'global')";
      params.push(projectId);
    } else {
      scopeCondition = "AND kc.scope = 'global'";
    }
  } else if (scope === 'global') {
    scopeCondition = "AND kc.scope = 'global'";
  } else {
    // Default: project + global
    if (projectId) {
      scopeCondition = "AND (kc.project_id = ? OR kc.scope = 'global')";
      params.push(projectId);
    }
  }

  // FTS5 search with BM25 ranking
  const sql = `
    SELECT kc.*, bm25(knowledge_chunks_fts) as rank,
           ks.name as source_name, ks.url as source_url, ks.category as source_category
    FROM knowledge_chunks_fts fts
    JOIN knowledge_chunks kc ON kc.rowid = fts.rowid
    JOIN knowledge_sources ks ON kc.source_id = ks.id
    WHERE knowledge_chunks_fts MATCH ?
      AND ks.enabled = 1
      AND ks.state = 'ready'
      ${scopeCondition}
    ORDER BY rank
    LIMIT ?
  `;

  try {
    const rows = db.prepare(sql).all(ftsQuery, ...params, maxChunks * 2);

    // Select within token budget
    const selected = [];
    let usedTokens = 0;

    for (const row of rows) {
      if (selected.length >= maxChunks) break;
      const tokens = row.token_estimate || estimateTokens(row.content);
      if (usedTokens + tokens > maxTokens && selected.length > 0) break;
      selected.push({
        id: row.id,
        sourceId: row.source_id,
        documentId: row.document_id,
        sourceName: row.source_name,
        sourceUrl: row.source_url,
        sourceCategory: row.source_category,
        title: row.title,
        content: row.content,
        position: row.position,
        scope: row.scope,
        version: row.version,
        tokenEstimate: tokens,
        rank: row.rank,
      });
      usedTokens += tokens;
    }

    logger.debug('Knowledge search', {
      query: query.slice(0, 100), results: rows.length, selected: selected.length, tokens: usedTokens,
    });

    return { chunks: selected, totalTokens: usedTokens };

  } catch (err) {
    // FTS5 query syntax errors are common
    logger.debug('Knowledge search error', { query, error: err.message });
    return { chunks: [], totalTokens: 0 };
  }
}

/**
 * Search with Redis caching.
 */
export async function searchKnowledgeCached(params) {
  const cacheKey = `rag:${JSON.stringify(params)}`;
  const cached = await redisGetJson(cacheKey);
  if (cached) return cached;

  const result = searchKnowledge(params);
  await redisSetJson(cacheKey, result, 300); // 5 min cache
  return result;
}

/**
 * Format knowledge chunks for inclusion in prompt context.
 */
export function formatChunksForContext(chunks) {
  if (!chunks || chunks.length === 0) return '';

  const sections = chunks.map((chunk, i) => {
    const source = chunk.sourceUrl ? `[${chunk.sourceName || 'Source'}](${chunk.sourceUrl})` : (chunk.sourceName || 'Source');
    return `--- Reference ${i + 1}: ${chunk.title || 'Untitled'} (${source}) ---\n${chunk.content}`;
  });

  return `\n<retrieved_knowledge>\n${sections.join('\n\n')}\n</retrieved_knowledge>`;
}

/**
 * Extract citation metadata from chunks for API response.
 */
export function extractCitations(chunks) {
  if (!chunks || chunks.length === 0) return [];
  return chunks.map(c => ({
    title: c.title || '',
    url: c.sourceUrl || '',
    source: c.sourceName || '',
    category: c.sourceCategory || '',
  }));
}
