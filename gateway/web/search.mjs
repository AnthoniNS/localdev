// gateway/web/search.mjs — SearXNG search integration, deep web research, and multi-page reading

import config from '../config.mjs';
import logger from '../logger.mjs';
import { fetchWebPage, readMultiplePages } from './reader.mjs';

/**
 * Normalize URL to prevent duplicates (remove trailing slashes, tracking params)
 */
function normalizeUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    // Remove UTM tracking and hash
    parsed.searchParams.delete('utm_source');
    parsed.searchParams.delete('utm_medium');
    parsed.searchParams.delete('utm_campaign');
    parsed.searchParams.delete('utm_term');
    parsed.searchParams.delete('utm_content');
    parsed.hash = '';
    let res = parsed.toString();
    if (res.endsWith('/') && parsed.pathname !== '/') res = res.slice(0, -1);
    return res;
  } catch {
    return rawUrl;
  }
}

/**
 * Search the web using the local SearXNG Docker container
 * @param {string} query Search terms
 * @param {Object} [options]
 * @param {string} [options.language='pt-BR']
 * @param {number} [options.page=1]
 * @param {number} [options.maxResults=5]
 * @param {number} [options.timeoutMs=10000]
 */
export async function webSearch(query, options = {}) {
  const {
    language = 'pt-BR',
    page = 1,
    maxResults = 5,
    timeoutMs = 12000
  } = options;

  if (!query || typeof query !== 'string') {
    throw new Error('A consulta de pesquisa não pode ser vazia.');
  }

  const searxUrl = (config.searxng?.baseUrl || 'http://127.0.0.1:8888').replace(/\/+$/, '');
  const targetUrl = new URL(`${searxUrl}/search`);
  targetUrl.searchParams.set('q', query);
  targetUrl.searchParams.set('format', 'json');
  targetUrl.searchParams.set('language', language);
  targetUrl.searchParams.set('pageno', String(page));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(targetUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LocalDevAI/1.1'
      },
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`SearXNG respondeu HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const rawResults = Array.isArray(data.results) ? data.results : [];

    // Deduplicate by normalized URL
    const seenUrls = new Set();
    const cleanResults = [];

    for (const r of rawResults) {
      if (!r.url) continue;
      const norm = normalizeUrl(r.url);
      if (seenUrls.has(norm)) continue;
      seenUrls.add(norm);

      cleanResults.push({
        title: r.title || 'Sem título',
        url: r.url,
        description: r.content || r.snippet || '',
        engine: r.engine || 'searxng',
        score: r.score || null
      });

      if (cleanResults.length >= maxResults) break;
    }

    return {
      query,
      totalFound: rawResults.length,
      returnedCount: cleanResults.length,
      results: cleanResults
    };
  } catch (err) {
    clearTimeout(timer);
    logger.error('Erro na pesquisa SearXNG', { query, error: err.message });
    throw new Error(`Falha na pesquisa web: ${err.message}`);
  }
}

/**
 * Perform autonomous deep web research:
 * 1. Queries SearXNG
 * 2. Selects top relevant URLs
 * 3. Fetches real content from each page
 * 4. Consolidates and structures findings with source citations
 */
export async function webResearch(query, options = {}) {
  const {
    maxResults = 3,
    language = 'pt-BR',
    maxContentPerSource = 6000,
    timeoutMs = 25000
  } = options;

  logger.info('Iniciando pesquisa aprofundada na web', { query, maxResults });

  // 1. Search
  const searchResult = await webSearch(query, {
    language,
    maxResults: Math.min(maxResults + 2, 8),
    timeoutMs: 10000
  });

  const urlsToFetch = (searchResult.results || [])
    .map(r => r.url)
    .slice(0, maxResults);

  if (urlsToFetch.length === 0) {
    return {
      query,
      sourcesCount: 0,
      sources: [],
      summary: 'Nenhum resultado relevante encontrado para a pesquisa solicitada.'
    };
  }

  // 2. Multi-page fetch with concurrency
  const pages = await readMultiplePages(urlsToFetch, {
    maxConcurrent: 3,
    timeoutMs: 15000,
    maxContentLength: maxContentPerSource,
    useCache: true
  });

  // 3. Assemble structured synthesis
  const structuredSources = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const originalMeta = searchResult.results.find(r => r.url === page.url) || {};

    if (page.ok && page.content && page.content.length > 50) {
      structuredSources.push({
        sourceIndex: structuredSources.length + 1,
        title: page.title || originalMeta.title || 'Página Técnica',
        url: page.url,
        description: page.description || originalMeta.description || '',
        content: page.content,
        fromCache: page.fromCache || false
      });
    }
  }

  return {
    query,
    sourcesCount: structuredSources.length,
    sources: structuredSources
  };
}
