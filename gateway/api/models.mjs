// gateway/api/models.mjs — OpenAI-compatible /v1/models endpoint with dynamic detection

import { getDb } from '../db/connection.mjs';
import config from '../config.mjs';
import { getAvailableModels } from '../llm/models-cache.mjs';

export async function handleModelsRequest(req, res) {
  const db = getDb();
  const configuredModels = db.prepare('SELECT * FROM models WHERE enabled = 1').all();

  // Get live models from backend (llama.cpp, Ollama, QwenProxy, etc.)
  let backendModels = [];
  try {
    backendModels = await getAvailableModels();
  } catch (err) {
    logger.warn('Falha ao buscar modelos do backend', { error: err.message });
  }

  const modelMap = new Map();

  // Add configured models from database
  for (const m of configuredModels) {
    modelMap.set(m.name, {
      id: m.name,
      object: 'model',
      created: Math.floor(new Date(m.created_at).getTime() / 1000),
      owned_by: 'localdevai',
      permission: [],
      root: m.name,
      parent: null
    });
  }

  // Add live models from backend
  for (const bm of backendModels) {
    if (bm.id && !modelMap.has(bm.id)) {
      modelMap.set(bm.id, {
        id: bm.id,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: bm.owned_by || 'backend',
        permission: [],
        root: bm.id,
        parent: null,
        context_window: bm.context_window
      });
    }
  }

  // If no models found, add a fallback
  if (modelMap.size === 0) {
    const defaultId = config.llm.defaultModel || 'local-model';
    modelMap.set(defaultId, {
      id: defaultId,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'localdevai',
      permission: [],
      root: defaultId,
      parent: null
    });
  }

  const responseData = {
    object: 'list',
    data: Array.from(modelMap.values())
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(responseData));
}
