// gateway/web/reader.mjs — Comprehensive web page fetcher and reader in Node.js
// Uses Fetch API, @mozilla/readability, JSDOM, Cheerio, and optional Playwright fallback.

import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';
import logger from '../logger.mjs';
import { getCachedPage, setCachedPage } from './cache.mjs';

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_CONTENT_LENGTH = 12000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 LocalDevAI/1.1';

/**
 * Clean and normalize extracted text
 */
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Extract content using Readability and JSDOM
 */
function extractWithReadability(html, url) {
  try {
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('error', () => {}); // Mute CSS parsing errors
    const dom = new JSDOM(html, { url, virtualConsole });
    const reader = new Readability(dom.window.document, {
      charThreshold: 20
    });
    const article = reader.parse();
    if (article && article.textContent && article.textContent.trim().length > 150) {
      return {
        title: article.title || '',
        byline: article.byline || '',
        excerpt: article.excerpt || '',
        content: cleanText(article.textContent),
        siteName: article.siteName || ''
      };
    }
  } catch (err) {
    logger.debug('Readability parsing falhou, caindo para Cheerio', { url, error: err.message });
  }
  return null;
}

/**
 * Fallback extraction using Cheerio (clean structure preserving code & headings)
 */
function extractWithCheerio(html) {
  const $ = cheerio.load(html);

  // Remove intrusive and useless elements
  $('script, style, noscript, nav, footer, header, aside, iframe, svg, form').remove();
  $('.ads, .ad, .advertisement, .cookie-banner, .banner, #cookie-notice').remove();

  const title = $('title').text() || $('h1').first().text() || '';
  const metaDesc = $('meta[name="description"]').attr('content') ||
                   $('meta[property="og:description"]').attr('content') || '';

  // Preserve pre and code blocks
  $('pre').each((_, el) => {
    $(el).prepend('\n```\n').append('\n```\n');
  });

  // Extract main/article content if present
  let bodyContainer = $('main, article, [role="main"], #content, .content, .documentation, .post-content').first();
  if (!bodyContainer.length) {
    bodyContainer = $('body');
  }

  const text = cleanText(bodyContainer.text());
  return {
    title: cleanText(title),
    excerpt: cleanText(metaDesc),
    content: text
  };
}

/**
 * Optional JavaScript rendering via Playwright if installed
 */
async function fetchWithPlaywright(url, timeoutMs = 20000) {
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(1000); // Wait briefly for hydration
    const html = await page.content();
    await browser.close();
    return html;
  } catch (err) {
    logger.debug('Playwright fallback não disponível ou falhou', { url, error: err.message });
    return null;
  }
}

/**
 * Fetch and extract clean main content from a web page
 * @param {string} url Target URL
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=15000]
 * @param {number} [options.maxContentLength=12000]
 * @param {boolean} [options.useCache=true]
 * @param {boolean} [options.enableJsFallback=true]
 */
export async function fetchWebPage(url, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxContentLength = DEFAULT_MAX_CONTENT_LENGTH,
    useCache = true,
    enableJsFallback = true,
    cacheTtl = 3600
  } = options;

  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error(`URL inválida: ${url}`);
  }

  // Check cache
  if (useCache) {
    const cached = getCachedPage(url);
    if (cached) {
      return {
        url,
        title: cached.title,
        description: cached.description,
        content: cached.content.slice(0, maxContentLength),
        fromCache: true,
        statusCode: cached.statusCode
      };
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let html = '';
  let statusCode = 200;
  let contentType = 'text/html';

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timer);
    statusCode = res.status;
    contentType = res.headers.get('content-type') || 'text/html';

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    if (!contentType.includes('html') && !contentType.includes('text') && !contentType.includes('xml')) {
      return {
        url,
        title: url,
        description: `Arquivo de tipo ${contentType}`,
        content: `[Conteúdo não textual (${contentType})]`,
        statusCode
      };
    }

    html = await res.text();
  } catch (fetchErr) {
    clearTimeout(timer);
    // If fetch failed or timed out, attempt Playwright if JS fallback enabled
    if (enableJsFallback) {
      const renderedHtml = await fetchWithPlaywright(url, timeoutMs);
      if (renderedHtml) {
        html = renderedHtml;
      } else {
        throw fetchErr;
      }
    } else {
      throw fetchErr;
    }
  }

  // Content extraction
  let extracted = extractWithReadability(html, url);
  if (!extracted || !extracted.content || extracted.content.length < 150) {
    extracted = extractWithCheerio(html);
  }

  // If content is still too sparse and JS fallback is allowed, try Playwright
  if (enableJsFallback && (!extracted || extracted.content.length < 100)) {
    const renderedHtml = await fetchWithPlaywright(url, timeoutMs);
    if (renderedHtml) {
      extracted = extractWithReadability(renderedHtml, url) || extractWithCheerio(renderedHtml);
    }
  }

  const finalTitle = extracted?.title || url;
  const finalDesc = extracted?.excerpt || '';
  const fullContent = extracted?.content || '';
  const limitedContent = fullContent.slice(0, maxContentLength);

  const result = {
    url,
    title: finalTitle,
    description: finalDesc,
    content: limitedContent,
    totalLength: fullContent.length,
    truncated: fullContent.length > maxContentLength,
    statusCode
  };

  // Cache successful result
  if (useCache && statusCode >= 200 && statusCode < 300 && limitedContent.length > 50) {
    setCachedPage(url, {
      title: finalTitle,
      description: finalDesc,
      content: limitedContent,
      statusCode,
      contentType
    }, cacheTtl);
  }

  return result;
}

/**
 * Read multiple pages in parallel with controlled concurrency and individual error isolation
 * @param {string[]} urls List of URLs
 * @param {Object} [options]
 * @param {number} [options.maxConcurrent=3]
 * @param {number} [options.timeoutMs=15000]
 * @param {number} [options.maxContentLength=8000]
 */
export async function readMultiplePages(urls = [], options = {}) {
  const {
    maxConcurrent = 3,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxContentLength = 8000,
    useCache = true
  } = options;

  const validUrls = Array.from(new Set((urls || []).filter(u => typeof u === 'string' && /^https?:\/\//i.test(u))));
  if (validUrls.length === 0) return [];

  const results = new Array(validUrls.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < validUrls.length) {
      const idx = currentIndex++;
      const targetUrl = validUrls[idx];
      try {
        const page = await fetchWebPage(targetUrl, {
          timeoutMs,
          maxContentLength,
          useCache,
          enableJsFallback: false // Fast mode for multiple pages
        });
        results[idx] = {
          url: targetUrl,
          ok: true,
          title: page.title,
          description: page.description,
          content: page.content,
          fromCache: page.fromCache || false
        };
      } catch (err) {
        results[idx] = {
          url: targetUrl,
          ok: false,
          error: err.message,
          content: `Falha ao ler página: ${err.message}`
        };
      }
    }
  }

  const concurrency = Math.min(maxConcurrent, validUrls.length);
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  return results;
}
