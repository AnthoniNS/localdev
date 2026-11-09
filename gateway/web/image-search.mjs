// gateway/web/image-search.mjs — Real image search via SearXNG

import config from '../config.mjs';
import logger from '../logger.mjs';
import { validateUrl } from '../knowledge/ssrf.mjs';

/**
 * Search for real images on the internet using SearXNG
 * @param {string} query - Search term for images
 * @param {Object} options
 * @param {number} [options.maxResults=5] - Maximum number of images to return
 * @param {string} [options.sizeFilter] - Size filter (large, medium, small, icon)
 * @param {string} [options.colorFilter] - Color filter (color, bw, red, green, blue, etc.)
 * @param {string} [options.typeFilter] - Type filter (photo, clipart, face, lineart)
 */
export async function searchImages(query, options = {}) {
  const {
    maxResults = 5,
    sizeFilter = '',
    colorFilter = '',
    typeFilter = ''
  } = options;

  const searxngUrl = config.searxng.baseUrl.replace(/\/+$/, '');
  
  // Build search parameters
  const params = new URLSearchParams({
    q: query,
    categories: 'images',
    format: 'json',
    language: 'pt-BR'
  });

  if (sizeFilter) params.append('sizetype', sizeFilter);
  if (colorFilter) params.append('color', colorFilter);
  if (typeFilter) params.append('type', typeFilter);

  const searchUrl = `${searxngUrl}/search?${params.toString()}`;

  try {
    logger.info('Buscando imagens na web', { query, maxResults });
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`SearXNG respondeu com HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      return {
        query,
        imagesCount: 0,
        images: [],
        message: 'Nenhuma imagem encontrada para esta busca.'
      };
    }

    // Extract image data from results
    const images = data.results
      .slice(0, maxResults)
      .map(result => ({
        url: result.img_src || result.url,
        thumbnail: result.thumbnail_src || result.img_src,
        title: result.title || 'Sem título',
        source: result.url,
        resolution: result.resolution || 'Desconhecida',
        width: result.width || null,
        height: result.height || null,
        engine: result.engine || 'unknown'
      }))
      .filter(img => img.url && img.url.startsWith('http'));

    logger.info('Imagens encontradas', { query, count: images.length });

    return {
      query,
      imagesCount: images.length,
      images,
      formattedResults: formatImageResults(images, query)
    };

  } catch (err) {
    logger.error('Erro ao buscar imagens', { error: err.message, query });
    return {
      query,
      imagesCount: 0,
      images: [],
      error: err.message
    };
  }
}

/**
 * Format image search results for LLM consumption
 */
function formatImageResults(images, query) {
  if (!images || images.length === 0) {
    return `Nenhuma imagem encontrada para "${query}".`;
  }

  const lines = [`[Imagens encontradas para "${query}"]:`];
  
  images.forEach((img, idx) => {
    lines.push(`${idx + 1}. **${img.title}**`);
    lines.push(`   URL: ${img.url}`);
    if (img.resolution !== 'Desconhecida') {
      lines.push(`   Resolução: ${img.resolution}`);
    }
    lines.push(`   Fonte: ${img.source}`);
    lines.push('');
  });

  lines.push('Use as URLs diretamente em tags <img> ou markdown para exibir as imagens.');
  
  return lines.join('\n');
}

/**
 * Search for product images (optimized for e-commerce)
 */
export async function searchProductImages(productName, options = {}) {
  const { maxResults = 5, category = '' } = options;
  
  // Build a more specific query for products
  let query = productName;
  if (category) {
    query = `${productName} ${category} produto`;
  } else {
    query = `${productName} produto foto`;
  }

  return searchImages(query, {
    maxResults,
    sizeFilter: 'large', // Prefer larger images for products
    typeFilter: 'photo'  // Prefer real photos over clipart
  });
}

/**
 * Search for stock/free images (for placeholders with style)
 */
export async function searchStockImages(concept, options = {}) {
  const { maxResults = 5, style = 'photo' } = options;
  
  const query = `${concept} ${style} stock free`;
  
  return searchImages(query, {
    maxResults,
    sizeFilter: 'large',
    typeFilter: style === 'photo' ? 'photo' : ''
  });
}
