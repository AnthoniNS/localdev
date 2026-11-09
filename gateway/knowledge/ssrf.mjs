// gateway/knowledge/ssrf.mjs — SSRF protection for URL ingestion

import { URL } from 'node:url';
import dns from 'node:dns/promises';
import logger from '../logger.mjs';

// Allowed protocols
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

// Private/reserved IP ranges to block
function isPrivateIP(ip) {
  // IPv4 checks
  const v4Match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4Match) {
    const a = Number(v4Match[1]);
    const b = Number(v4Match[2]);
    return (
      a === 0 ||                                  // 0.0.0.0/8
      a === 10 ||                                 // 10.0.0.0/8
      a === 127 ||                                // 127.0.0.0/8
      (a === 169 && b === 254) ||                 // 169.254.0.0/16 (link-local)
      (a === 172 && b >= 16 && b <= 31) ||        // 172.16.0.0/12
      (a === 192 && b === 168) ||                 // 192.168.0.0/16
      (a === 100 && b >= 64 && b <= 127) ||       // 100.64.0.0/10 (CGNAT)
      (a === 198 && b === 18) ||                  // 198.18.0.0/15 (benchmark)
      (a === 198 && b === 19) ||
      a === 240 ||                                // 240.0.0.0/4 (reserved)
      a === 255                                   // 255.255.255.255 (broadcast)
    );
  }

  // IPv6 checks
  const ipLower = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (ipLower === '::1' || ipLower === '::' || ipLower === '0:0:0:0:0:0:0:1') return true;
  if (ipLower.startsWith('fe80:')) return true;   // Link-local
  if (ipLower.startsWith('fc') || ipLower.startsWith('fd')) return true; // ULA
  if (ipLower.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 — extract and check IPv4 part
    const v4Part = ipLower.slice(7);
    return isPrivateIP(v4Part);
  }

  return false;
}

// Known internal service ports to block
const BLOCKED_PORTS = new Set([6379, 5432, 3306, 27017, 11211, 2379, 9200]); // Redis, PG, MySQL, Mongo, etc.

// Explicit allowlist for internal URLs (empty by default)
let internalAllowlist = [];

export function setInternalAllowlist(list) {
  internalAllowlist = list || [];
}

function isAllowlisted(url) {
  for (const pattern of internalAllowlist) {
    if (url.startsWith(pattern)) return true;
  }
  return false;
}

/**
 * Validate a URL for safe ingestion.
 * Returns { ok: true, url } or { ok: false, error }
 */
export async function validateUrl(rawUrl, { maxRedirects = 5 } = {}) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: 'Invalid URL format' };
  }

  // Check protocol
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { ok: false, error: `Protocol ${parsed.protocol} is not allowed. Use HTTP or HTTPS.` };
  }

  // Check explicit allowlist
  if (isAllowlisted(rawUrl)) {
    return { ok: true, url: parsed.href };
  }

  // Check hostname
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return { ok: false, error: 'Localhost URLs are blocked' };
  }

  // Check port
  if (parsed.port && BLOCKED_PORTS.has(Number(parsed.port))) {
    return { ok: false, error: `Port ${parsed.port} is blocked (known internal service)` };
  }

  // Resolve DNS and check IPs
  try {
    let addresses;
    // Check if hostname is already an IP
    if (isPrivateIP(hostname)) {
      return { ok: false, error: 'Private/reserved IP addresses are blocked' };
    }

    // Resolve hostname
    try {
      addresses = await dns.resolve4(hostname);
    } catch {
      try {
        addresses = await dns.resolve6(hostname);
      } catch {
        return { ok: false, error: `Cannot resolve hostname: ${hostname}` };
      }
    }

    // Check resolved IPs
    for (const ip of addresses) {
      if (isPrivateIP(ip)) {
        return { ok: false, error: `Hostname ${hostname} resolves to private IP ${ip}` };
      }
    }
  } catch (err) {
    if (err.message.includes('blocked') || err.message.includes('private')) {
      return { ok: false, error: err.message };
    }
    // DNS resolution may fail for valid reasons (firewall, etc)
    logger.warn('DNS validation warning', { url: rawUrl, error: err.message });
  }

  return { ok: true, url: parsed.href };
}

/**
 * Validate a URL during redirect following.
 * Each redirect target must pass SSRF checks.
 */
export async function validateRedirect(newUrl) {
  return validateUrl(newUrl);
}

/**
 * Safe fetch with SSRF protection.
 * Re-validates on each redirect.
 */
export async function safeFetch(url, options = {}) {
  const { timeout = 30000, maxSize = 2_000_000, maxRedirects = 5 } = options;

  // Initial validation
  const check = await validateUrl(url);
  if (!check.ok) throw new Error(`SSRF blocked: ${check.error}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(check.url, {
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        'User-Agent': 'LocalDevAI/1.0 (knowledge ingestion)',
        'Accept': 'text/html,text/plain,application/xhtml+xml,application/xml;q=0.9',
        ...(options.headers || {}),
      },
    });

    // Handle redirects manually with SSRF checks
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect without Location header');
      if (maxRedirects <= 0) throw new Error('Too many redirects');

      const absUrl = new URL(location, url).href;
      const redirectCheck = await validateRedirect(absUrl);
      if (!redirectCheck.ok) throw new Error(`SSRF blocked on redirect: ${redirectCheck.error}`);

      return safeFetch(absUrl, { ...options, maxRedirects: maxRedirects - 1 });
    }

    // Check response size via Content-Length
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > maxSize) {
      throw new Error(`Response too large: ${contentLength} bytes (max: ${maxSize})`);
    }

    return response;
  } finally {
    clearTimeout(timer);
  }
}
