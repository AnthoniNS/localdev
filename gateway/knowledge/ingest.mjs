// gateway/knowledge/ingest.mjs — Content ingestion pipeline

import crypto from 'node:crypto';
import { getDb } from '../db/connection.mjs';
import config from '../config.mjs';
import logger from '../logger.mjs';
import { safeFetch, validateUrl } from './ssrf.mjs';
import { estimateTokens } from '../context/tokens.mjs';

// Active ingestion jobs tracking
const activeJobs = new Map();

/**
 * Extract main content from HTML, removing navigation, ads, scripts, etc.
 */
function extractContent(html, url) {
  // Remove scripts, styles, nav elements
  let text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

  // Convert block elements to newlines
  text = text
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr|\/dt|\/dd|\/section|\/article)\b[^>]*>/gi, '\n')
    .replace(/<(h[1-6])\b[^>]*>/gi, '\n\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t\r]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();

  return { title, text };
}

/**
 * Split text into chunks with overlap.
 */
function chunkText(text, { chunkSize = 500, chunkOverlap = 50 } = {}) {
  if (!text) return [];

  // Split by paragraphs first, then by sentences
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let currentChunk = '';
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    if (currentTokens + paraTokens > chunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      // Keep overlap from end of previous chunk
      const overlapText = currentChunk.split(/\s+/).slice(-Math.ceil(chunkOverlap / 2)).join(' ');
      currentChunk = overlapText + '\n\n' + para;
      currentTokens = estimateTokens(currentChunk);
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
      currentTokens += paraTokens;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // Handle case where a single paragraph exceeds chunk size
  const result = [];
  for (const chunk of chunks) {
    if (estimateTokens(chunk) > chunkSize * 1.5) {
      // Split by sentences
      const sentences = chunk.split(/(?<=[.!?])\s+/);
      let subChunk = '';
      for (const sent of sentences) {
        if (estimateTokens(subChunk + sent) > chunkSize && subChunk) {
          result.push(subChunk.trim());
          subChunk = sent;
        } else {
          subChunk += (subChunk ? ' ' : '') + sent;
        }
      }
      if (subChunk.trim()) result.push(subChunk.trim());
    } else {
      result.push(chunk);
    }
  }

  return result;
}

/**
 * Ingest a single URL document.
 */
async function ingestDocument(sourceId, url, sourceScope, projectId) {
  const db = getDb();
  const startTime = Date.now();

  // Fetch with SSRF protection
  const response = await safeFetch(url, {
    timeout: config.ingest.timeout,
    maxSize: config.ingest.maxPageSize,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!/text\/html|text\/plain|application\/xhtml\+xml|application\/xml/i.test(contentType)) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }

  const html = await response.text();
  if (html.length > config.ingest.maxPageSize) {
    throw new Error(`Content too large: ${html.length} bytes`);
  }

  const contentHash = crypto.createHash('sha256').update(html).digest('hex');

  // Check if content has changed
  const existingDoc = db.prepare('SELECT * FROM knowledge_documents WHERE source_id = ? AND url = ?').get(sourceId, url);
  if (existingDoc && existingDoc.content_hash === contentHash) {
    logger.debug('Document unchanged, skipping', { url, sourceId });
    return { unchanged: true, docId: existingDoc.id };
  }

  // Extract content
  const { title, text } = extractContent(html, url);

  if (!text || text.length < 50) {
    throw new Error('Extracted content too short or empty');
  }

  // Create or update document
  const docId = existingDoc ? existingDoc.id : crypto.randomUUID();
  const version = existingDoc ? existingDoc.version + 1 : 1;

  if (existingDoc) {
    db.prepare(`UPDATE knowledge_documents SET
      title = ?, content_hash = ?, content_length = ?, version = ?,
      state = 'ready', last_error = NULL, updated_at = datetime('now')
      WHERE id = ?`).run(title, contentHash, text.length, version, docId);

    // Remove old chunks for this document
    db.prepare('DELETE FROM knowledge_chunks WHERE document_id = ?').run(docId);
  } else {
    db.prepare(`INSERT INTO knowledge_documents (id, source_id, url, title, content_hash, content_length, version, state)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ready')`).run(
      docId, sourceId, url, title, contentHash, text.length, version
    );
  }

  // Create chunks
  const chunks = chunkText(text, {
    chunkSize: config.ingest.chunkSize,
    chunkOverlap: config.ingest.chunkOverlap,
  });

  const insertChunk = db.prepare(`INSERT INTO knowledge_chunks
    (id, source_id, document_id, project_id, scope, title, content, position, token_estimate, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const insertChunks = db.transaction(() => {
    for (let i = 0; i < chunks.length; i++) {
      insertChunk.run(
        crypto.randomUUID(), sourceId, docId,
        projectId || null, sourceScope,
        title, chunks[i], i,
        estimateTokens(chunks[i]), version
      );
    }
  });

  insertChunks();

  const duration = Date.now() - startTime;
  logger.info('Document ingested', { url, docId, chunks: chunks.length, duration });

  return { docId, title, chunks: chunks.length, duration, unchanged: false };
}

/**
 * Discover pages from a source (sitemap or crawl).
 */
async function discoverPages(source) {
  const pages = [source.url]; // Always include the main URL

  if (source.crawl_mode === 'single') {
    return pages;
  }

  if (source.crawl_mode === 'sitemap') {
    try {
      const sitemapUrl = new URL('/sitemap.xml', source.url).href;
      const check = await validateUrl(sitemapUrl);
      if (!check.ok) return pages;

      const response = await safeFetch(sitemapUrl, { timeout: 15000, maxSize: 5_000_000 });
      if (response.ok) {
        const xml = await response.text();
        const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/gi)].map(m => m[1].trim());
        const baseUrl = new URL(source.url);
        for (const u of urls) {
          if (pages.length >= config.ingest.maxPagesPerSource) break;
          try {
            const parsed = new URL(u);
            if (parsed.hostname === baseUrl.hostname && !pages.includes(u)) {
              pages.push(u);
            }
          } catch { /* skip invalid */ }
        }
      }
    } catch (err) {
      logger.warn('Sitemap fetch failed', { url: source.url, error: err.message });
    }
  }

  if (source.crawl_mode === 'crawl') {
    // Basic breadth-first crawl within the source domain
    const baseUrl = new URL(source.url);
    const visited = new Set([source.url]);
    const queue = [{ url: source.url, depth: 0 }];

    while (queue.length > 0 && pages.length < config.ingest.maxPagesPerSource) {
      const { url, depth } = queue.shift();
      if (depth >= (source.crawl_depth || config.ingest.maxCrawlDepth)) continue;

      try {
        const check = await validateUrl(url);
        if (!check.ok) continue;

        const resp = await safeFetch(url, { timeout: 10000, maxSize: config.ingest.maxPageSize });
        if (!resp.ok) continue;

        const html = await resp.text();
        const links = [...html.matchAll(/href=["'](.*?)["']/gi)].map(m => m[1]);

        for (const link of links) {
          if (pages.length >= config.ingest.maxPagesPerSource) break;
          try {
            const abs = new URL(link, url);
            // Same domain, HTTP(S), no fragments, not visited
            if (abs.hostname === baseUrl.hostname && ['http:', 'https:'].includes(abs.protocol)) {
              abs.hash = '';
              const clean = abs.href;
              if (!visited.has(clean)) {
                visited.add(clean);
                pages.push(clean);
                queue.push({ url: clean, depth: depth + 1 });
              }
            }
          } catch { /* skip */ }
        }
      } catch { /* skip page */ }
    }
  }

  return pages;
}

/**
 * Run full ingestion for a knowledge source.
 */
export async function ingestSource(sourceId) {
  const db = getDb();
  const source = db.prepare('SELECT * FROM knowledge_sources WHERE id = ?').get(sourceId);
  if (!source) throw new Error('Source not found');

  // Prevent concurrent ingestion of same source
  if (activeJobs.has(sourceId)) {
    throw new Error('Ingestion already in progress for this source');
  }

  activeJobs.set(sourceId, { startedAt: Date.now() });

  // Update source state
  db.prepare("UPDATE knowledge_sources SET state = 'processing', updated_at = datetime('now') WHERE id = ?").run(sourceId);

  const startTime = Date.now();
  let totalDocs = 0;
  let totalChunks = 0;
  let errors = [];

  try {
    // Validate main URL
    const urlCheck = await validateUrl(source.url);
    if (!urlCheck.ok) {
      throw new Error(`URL validation failed: ${urlCheck.error}`);
    }

    // Discover pages
    const pages = await discoverPages(source);
    logger.info('Pages discovered', { sourceId, count: pages.length });

    // Ingest each page
    for (const pageUrl of pages) {
      try {
        const result = await ingestDocument(sourceId, pageUrl, source.scope, source.project_id);
        if (!result.unchanged) {
          totalDocs++;
          totalChunks += result.chunks || 0;
        }
      } catch (err) {
        errors.push({ url: pageUrl, error: err.message });
        logger.warn('Page ingestion failed', { sourceId, url: pageUrl, error: err.message });
      }
    }

    // Update source metadata
    const docCount = db.prepare('SELECT COUNT(*) as c FROM knowledge_documents WHERE source_id = ?').get(sourceId).c;
    const chunkCount = db.prepare('SELECT COUNT(*) as c FROM knowledge_chunks WHERE source_id = ?').get(sourceId).c;
    const contentHash = crypto.createHash('sha256').update(pages.join(',')).digest('hex').slice(0, 16);

    db.prepare(`UPDATE knowledge_sources SET
      state = 'ready', last_crawled_at = datetime('now'), last_success_at = datetime('now'),
      last_error = ?, content_hash = ?, version = version + 1,
      doc_count = ?, chunk_count = ?, updated_at = datetime('now')
      WHERE id = ?`).run(
      errors.length > 0 ? JSON.stringify(errors.slice(0, 5)) : null,
      contentHash, docCount, chunkCount, sourceId
    );

    // Log ingestion
    const duration = Date.now() - startTime;
    db.prepare(`INSERT INTO ingestion_log (source_id, action, status, docs_processed, chunks_created, duration_ms, error)
      VALUES (?, 'ingest', 'success', ?, ?, ?, ?)`).run(
      sourceId, totalDocs, totalChunks, duration,
      errors.length > 0 ? JSON.stringify(errors.slice(0, 5)) : null
    );

    logger.info('Source ingestion complete', { sourceId, docs: totalDocs, chunks: totalChunks, errors: errors.length, duration });
    return { success: true, docs: totalDocs, chunks: totalChunks, errors, duration };

  } catch (err) {
    db.prepare("UPDATE knowledge_sources SET state = 'error', last_error = ?, updated_at = datetime('now') WHERE id = ?").run(
      err.message, sourceId
    );
    db.prepare(`INSERT INTO ingestion_log (source_id, action, status, duration_ms, error)
      VALUES (?, 'ingest', 'error', ?, ?)`).run(sourceId, Date.now() - startTime, err.message);

    logger.error('Source ingestion failed', { sourceId, error: err.message });
    throw err;

  } finally {
    activeJobs.delete(sourceId);
  }
}

/**
 * Test if a URL is accessible and can be ingested.
 */
export async function testUrl(url) {
  const check = await validateUrl(url);
  if (!check.ok) return { ok: false, error: check.error };

  try {
    const response = await safeFetch(url, { timeout: 10000, maxSize: 500_000 });
    const contentType = response.headers.get('content-type') || '';
    return {
      ok: response.ok,
      status: response.status,
      contentType,
      supported: /text\/html|text\/plain|application\/xhtml/i.test(contentType),
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export { chunkText, extractContent };
