// gateway/context/manager.mjs — Automatic context detection and threshold management

import config from '../config.mjs';
import logger from '../logger.mjs';
import { getDb } from '../db/connection.mjs';

let detectedContextLimit = null;
let lastDetectAttempt = 0;

/**
 * Thresholds de gerenciamento automático de contexto.
 * Nota: 'newSession' em 0.80 (80%) é intencional. Deixa 20% de margem para a IA
 * gerar a resposta sem estourar o limite máximo (100%) e causar truncamento no llama.cpp.
 * Esperar até 90% ou 95% resulta em falha de geração em respostas longas.
 */
export const CONTEXT_THRESHOLDS = {
  warning: 0.65,      // Apenas alerta visual no dashboard
  checkpoint: 0.75,   // Salva o estado da tarefa de forma persistente
  newSession: 0.80,   // Gatilho automático para criar nova conversa com resumo de estado
  max: 0.90           // Limite absoluto de segurança
};

/**
 * Automatically detect max context length configured in llama.cpp
 */
export async function detectMaxContext(baseUrl = config.llm.baseUrl) {
  // Cache for 60 seconds
  if (detectedContextLimit && Date.now() - lastDetectAttempt < 60000) {
    return detectedContextLimit;
  }
  lastDetectAttempt = Date.now();

  const url = baseUrl.replace(/\/+$/, '');

  // 1. Try llama.cpp server /props endpoint
  try {
    const res = await fetch(`${url}/props`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      const nCtx = data.default_generation_settings?.n_ctx;
      if (typeof nCtx === 'number' && nCtx >= 1024) {
        detectedContextLimit = nCtx;
        logger.info('Contexto detectado automaticamente via llama.cpp /props', { n_ctx: nCtx });
        return nCtx;
      }
    }
  } catch {}

  // 2. Try DB models table if a model has max_context
  try {
    const db = getDb();
    const modelRow = db.prepare('SELECT max_context FROM models WHERE is_default = 1').get() ||
                     db.prepare('SELECT max_context FROM models LIMIT 1').get();
    if (modelRow && modelRow.max_context >= 1024) {
      detectedContextLimit = modelRow.max_context;
      return modelRow.max_context;
    }
  } catch {}

  // 3. Fallback to centralized config
  detectedContextLimit = config.context.maxContextTokens || 8192;
  return detectedContextLimit;
}

/**
 * Evaluate token usage and determine required action
 */
export function evaluateContextUsage(tokensUsed, maxContext) {
  const limit = maxContext || detectedContextLimit || config.context.maxContextTokens || 8192;
  const ratio = tokensUsed / limit;

  return {
    tokensUsed,
    maxContext: limit,
    ratio: Math.round(ratio * 100) / 100,
    percentage: Math.round(ratio * 100),
    isWarning: ratio >= CONTEXT_THRESHOLDS.warning,
    needsCheckpoint: ratio >= CONTEXT_THRESHOLDS.checkpoint,
    needsNewSession: ratio >= CONTEXT_THRESHOLDS.newSession,
    isCritical: ratio >= CONTEXT_THRESHOLDS.max
  };
}

/**
 * Get current context status for the Dashboard
 */
export async function getContextStatus(currentTokens = 0) {
  const maxCtx = await detectMaxContext();
  return evaluateContextUsage(currentTokens, maxCtx);
}
