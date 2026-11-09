// gateway/llm/models-cache.mjs — Dynamic model discovery and caching

import config from '../config.mjs';
import logger from '../logger.mjs';
import { fetchBackendModels } from './proxy.mjs';

let cachedModels = [];
let lastFetch = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Fetch and cache available models from backend
 */
export async function getAvailableModels(forceRefresh = false) {
  const now = Date.now();
  
  if (!forceRefresh && cachedModels.length > 0 && now - lastFetch < CACHE_TTL) {
    return cachedModels;
  }

  try {
    const models = await fetchBackendModels();
    cachedModels = models.map(m => ({
      id: m.id,
      name: m.name || m.id,
      owned_by: m.owned_by || 'unknown',
      context_window: m.context_window || m.max_context_length || 8192
    }));
    lastFetch = now;
    
    logger.info('Modelos disponíveis detectados', { 
      count: cachedModels.length,
      models: cachedModels.map(m => m.id)
    });
    
    return cachedModels;
  } catch (err) {
    logger.warn('Falha ao buscar modelos do backend', { error: err.message });
    return cachedModels; // Return cached even if fetch fails
  }
}

/**
 * Get the default model (first available or configured)
 */
export async function getDefaultModel() {
  const models = await getAvailableModels();
  
  // If we have a configured default and it exists in backend, use it
  const configuredDefault = config.llm.defaultModel;
  if (configuredDefault && models.find(m => m.id === configuredDefault)) {
    return configuredDefault;
  }
  
  // Otherwise, use the first available model
  if (models.length > 0) {
    return models[0].id;
  }
  
  // Fallback
  return 'local-model';
}

/**
 * Validate if a model exists in the backend
 */
export async function validateModel(modelId) {
  const models = await getAvailableModels();
  return models.some(m => m.id === modelId);
}

/**
 * Resolve model ID: validate and fallback if needed
 */
export async function resolveModelId(requestedModel) {
  if (!requestedModel || requestedModel === 'local-model') {
    return await getDefaultModel();
  }
  
  const isValid = await validateModel(requestedModel);
  if (isValid) {
    return requestedModel;
  }
  
  logger.warn('Modelo solicitado não encontrado, usando padrão', { 
    requested: requestedModel 
  });
  return await getDefaultModel();
}
