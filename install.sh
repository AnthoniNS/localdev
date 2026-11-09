#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "ERRO: instale Node.js 20 ou superior."
  exit 1
fi
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "ERRO: Node.js 20+ é necessário. Versão atual: $(node --version)"
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Arquivo .env criado a partir de .env.example."
fi

if grep -q "replace-this-with-a-long-random-secret" searxng/settings.yml 2>/dev/null; then
  SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  sed -i "s/replace-this-with-a-long-random-secret/$SECRET/g" searxng/settings.yml
fi

npm install
npm test

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose up -d
else
  echo "AVISO: Docker Compose não encontrado. SearXNG e Redis não foram iniciados via contêiner."
fi

echo
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║             LocalDevAI instalado com sucesso!                ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  🌐 Painel Admin & Dashboard: http://127.0.0.1:8099/admin     ║"
echo "║  🤖 API OpenAI Gateway:       http://127.0.0.1:8099/v1        ║"
echo "║  🔍 SearXNG Metabusca:        http://127.0.0.1:8888           ║"
echo "║  🧠 llama.cpp esperado:       http://127.0.0.1:8080/v1        ║"
echo "║  ⚡ Redis Cache:              127.0.0.1:6379                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo
echo "Para iniciar o Gateway:"
echo "  npm start"
echo
echo "Para executar os testes:"
echo "  npm test"
echo
