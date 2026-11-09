// gateway/knowledge/catalog.mjs — Search and access the 156-resource technical knowledge catalog

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from '../logger.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, 'catalog.json');

let cachedCatalog = null;
let lastLoaded = 0;

/**
 * Load the catalog with caching
 */
export function loadCatalog(forceReload = false) {
  if (!forceReload && cachedCatalog && Date.now() - lastLoaded < 60000) {
    return cachedCatalog;
  }
  try {
    if (fs.existsSync(CATALOG_PATH)) {
      const raw = fs.readFileSync(CATALOG_PATH, 'utf8');
      cachedCatalog = JSON.parse(raw);
      lastLoaded = Date.now();
      return cachedCatalog;
    }
  } catch (err) {
    logger.error('Falha ao carregar catálogo de conhecimento JSON', { error: err.message });
  }
  return { resources: [] };
}

/**
 * Search technical resources in the catalog
 * @param {Object} options
 * @param {string} [options.query] Search term (library, tech, keyword)
 * @param {string} [options.category] Filter by category
 * @param {number} [options.limit=5] Maximum results to return
 * @param {boolean} [options.cdnOnly=false] Only return resources with valid CDN URLs
 */
export function searchKnowledgeCatalog({ query = '', category = '', limit = 5, cdnOnly = false } = {}) {
  const catalog = loadCatalog();
  const resources = catalog.resources || [];
  const normalizedQuery = (query || '').toLowerCase().trim();
  const queryTokens = normalizedQuery ? normalizedQuery.split(/\s+/).filter(Boolean) : [];
  const targetCategory = (category || '').toLowerCase().trim();

  const matches = [];

  for (const item of resources) {
    if (item.enabled === false) continue;
    if (cdnOnly && !item.cdn_url) continue;
    if (targetCategory && item.category.toLowerCase() !== targetCategory) continue;

    let score = 0;
    const nameLower = (item.name || '').toLowerCase();
    const descLower = (item.description || '').toLowerCase();
    const catLower = (item.category || '').toLowerCase();
    const keywords = Array.isArray(item.keywords) ? item.keywords.map(k => String(k).toLowerCase()) : [];

    if (!queryTokens.length) {
      score = 1;
    } else {
      // Exact name match
      if (nameLower === normalizedQuery) score += 100;
      else if (nameLower.startsWith(normalizedQuery)) score += 60;
      else if (nameLower.includes(normalizedQuery)) score += 40;

      // Token matches
      for (const token of queryTokens) {
        if (nameLower.includes(token)) score += 25;
        if (catLower.includes(token)) score += 20;
        if (keywords.includes(token)) score += 20;
        else if (keywords.some(k => k.includes(token))) score += 10;
        if (descLower.includes(token)) score += 8;
      }
    }

    if (score > 0) {
      matches.push({
        score,
        name: item.name,
        category: item.category,
        type: item.type,
        cdn_url: item.cdn_url,
        documentation_url: item.documentation_url,
        description: item.description,
        usage_guidance: item.cdn_url 
          ? `Disponível via CDN: ${item.cdn_url}` 
          : `Não possui CDN direto. Instale via gerenciador de pacotes da stack ou consulte ${item.documentation_url}`
      });
    }
  }

  // Sort by relevance score
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, Math.max(1, Math.min(limit, 20)));
}

/**
 * Format catalog search results concisely for the LLM
 */
export function formatCatalogResults(results) {
  if (!results || results.length === 0) {
    return 'Nenhum recurso encontrado no catálogo técnico local.';
  }

  const lines = ['[Catálogo Técnico LocalDevAI — Recursos Relevantes]:'];
  for (const r of results) {
    lines.push(`• **${r.name}** (${r.category} | Tipo: ${r.type})`);
    lines.push(`  - Descrição: ${r.description}`);
    if (r.cdn_url) {
      lines.push(`  - CDN: ${r.cdn_url}`);
    } else {
      lines.push(`  - CDN: Não aplicável (instale via npm/composer/pub.dev ou registry oficial)`);
    }
    lines.push(`  - Documentação Oficial: ${r.documentation_url}`);
  }
  return lines.join('\n');
}

/**
 * Get distinct catalog categories
 */
export function getCatalogCategories() {
  const catalog = loadCatalog();
  const cats = new Set((catalog.resources || []).map(r => r.category));
  return Array.from(cats).sort();
}
