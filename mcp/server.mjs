import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const PROJECT_ROOT = path.resolve(process.env.LOCALDEVAI_PROJECT || process.cwd());
const SEARXNG_URL = (process.env.LOCALDEVAI_SEARXNG_URL || "http://127.0.0.1:8888").replace(/\/+$/, "");
const MAX_FILE_BYTES = 200_000;
const MAX_RESULTS = 8;

function insideProject(target) {
  const resolved = path.resolve(PROJECT_ROOT, target);
  if (resolved !== PROJECT_ROOT && !resolved.startsWith(PROJECT_ROOT + path.sep)) {
    throw new Error("Acesso negado: o caminho está fora da pasta do projeto configurada.");
  }
  return resolved;
}

function isBlockedHost(hostname) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h === "::1" || h === "0.0.0.0") return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127);
  }
  return false;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

const server = new McpServer({
  name: "LocalDevAI",
  version: "1.0.0"
});

server.tool(
  "web_search",
  "Pesquisa na internet usando a instância SearXNG local. Retorna títulos, trechos e URLs.",
  {
    query: z.string().min(2).max(500).describe("O que pesquisar na internet"),
    language: z.string().optional().default("pt-BR").describe("Idioma preferido, por exemplo pt-BR ou en-US"),
    page: z.number().int().min(1).max(5).optional().default(1)
  },
  async ({ query, language, page }) => {
    const url = new URL(`${SEARXNG_URL}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("language", language || "pt-BR");
    url.searchParams.set("pageno", String(page || 1));
    const response = await fetchWithTimeout(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`SearXNG respondeu HTTP ${response.status}. Confira se o formato JSON está ativado.`);
    const data = await response.json();
    const results = (data.results || []).slice(0, MAX_RESULTS).map((r) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: (r.content || "").slice(0, 900),
      engine: r.engine || ""
    }));
    return { content: [{ type: "text", text: JSON.stringify({ query, results }, null, 2) }] };
  }
);

server.tool(
  "web_fetch",
  "Abre uma página pública HTTP/HTTPS e extrai texto simples. Use para ler documentação e páginas encontradas na pesquisa.",
  { url: z.string().url().describe("URL pública HTTP/HTTPS") },
  async ({ url: rawUrl }) => {
    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Só são permitidas URLs HTTP/HTTPS.");
    if (isBlockedHost(parsed.hostname)) throw new Error("URL local ou endereço privado bloqueado.");
    const response = await fetchWithTimeout(parsed, {
      headers: { "user-agent": "LocalDevAI/1.0 (local research agent)", accept: "text/html,text/plain,application/xhtml+xml" }
    }, 18000);
    if (!response.ok) throw new Error(`A página respondeu HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type") || "";
    if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) {
      throw new Error(`Tipo de conteúdo não suportado: ${contentType}`);
    }
    const html = (await response.text()).slice(0, 1_000_000);
    const text = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
      .replace(/[ \t\r]+/g, " ").replace(/\n\s*\n+/g, "\n\n")
      .trim().slice(0, 16000);
    return { content: [{ type: "text", text: `URL: ${response.url}\nContent-Type: ${contentType}\n\n${text}` }] };
  }
);

server.tool(
  "list_project_files",
  "Lista arquivos e pastas dentro da raiz de projeto permitida. Ignora dependências e diretórios Git.",
  {
    relative_path: z.string().optional().default(".").describe("Pasta relativa à raiz do projeto"),
    max_entries: z.number().int().min(1).max(200).optional().default(100)
  },
  async ({ relative_path, max_entries }) => {
    const root = insideProject(relative_path || ".");
    const ignored = new Set([".git", "node_modules", ".next", "dist", "build", ".dart_tool", ".venv", "vendor"]);
    async function walk(dir, depth, out) {
      if (depth > 4 || out.length >= (max_entries || 100)) return;
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const ent of entries) {
        if (ignored.has(ent.name) || ent.name.startsWith(".env")) continue;
        const full = path.join(dir, ent.name);
        const rel = path.relative(PROJECT_ROOT, full);
        out.push(`${ent.isDirectory() ? "[DIR] " : "[FILE] "}${rel}`);
        if (ent.isDirectory() && out.length < (max_entries || 100)) await walk(full, depth + 1, out);
        if (out.length >= (max_entries || 100)) break;
      }
    }
    const out = [];
    await walk(root, 0, out);
    return { content: [{ type: "text", text: out.join("\n") || "(nenhum arquivo encontrado)" }] };
  }
);

server.tool(
  "read_project_file",
  "Lê um arquivo de texto dentro da raiz do projeto. Não acessa arquivos fora do projeto nem arquivos maiores que 200 KB.",
  { relative_path: z.string().min(1).max(1000).describe("Caminho relativo do arquivo") },
  async ({ relative_path }) => {
    const full = insideProject(relative_path);
    const stat = await fs.stat(full);
    if (!stat.isFile()) throw new Error("O caminho informado não é um arquivo.");
    if (stat.size > MAX_FILE_BYTES) throw new Error(`Arquivo excede o limite de ${MAX_FILE_BYTES} bytes.`);
    const content = await fs.readFile(full, "utf8");
    return { content: [{ type: "text", text: `Arquivo: ${path.relative(PROJECT_ROOT, full)}\n\n${content}` }] };
  }
);

server.tool(
  "search_project_text",
  "Pesquisa texto literal em arquivos de código dentro do projeto, sem entrar em dependências ou pastas de build.",
  {
    query: z.string().min(1).max(200),
    relative_path: z.string().optional().default("."),
    max_matches: z.number().int().min(1).max(100).optional().default(40)
  },
  async ({ query, relative_path, max_matches }) => {
    const root = insideProject(relative_path || ".");
    const ignored = new Set([".git", "node_modules", ".next", "dist", "build", ".dart_tool", ".venv", "vendor"]);
    const matches = [];
    const extensions = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json", ".md", ".yml", ".yaml", ".php", ".py", ".dart", ".html", ".css", ".scss", ".sql", ".sh", ".toml", ".xml", ".txt"]);
    async function walk(dir, depth = 0) {
      if (depth > 6 || matches.length >= (max_matches || 40)) return;
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const ent of entries) {
        if (ignored.has(ent.name) || ent.name.startsWith(".env")) continue;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) await walk(full, depth + 1);
        else if (extensions.has(path.extname(ent.name).toLowerCase())) {
          try {
            const stat = await fs.stat(full);
            if (stat.size > 300_000) continue;
            const lines = (await fs.readFile(full, "utf8")).split(/\r?\n/);
            lines.forEach((line, i) => {
              if (line.toLowerCase().includes(query.toLowerCase()) && matches.length < (max_matches || 40)) {
                matches.push(`${path.relative(PROJECT_ROOT, full)}:${i + 1}: ${line.trim().slice(0, 400)}`);
              }
            });
          } catch {}
        }
        if (matches.length >= (max_matches || 40)) return;
      }
    }
    await walk(root);
    return { content: [{ type: "text", text: matches.join("\n") || "Nenhuma correspondência encontrada." }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
