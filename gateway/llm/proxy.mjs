// gateway/llm/proxy.mjs — LLM Backend proxy to llama.cpp / OpenAI-compatible backends

import config from '../config.mjs';
import logger from '../logger.mjs';

/**
 * Test connectivity to llama.cpp backend
 */
export async function testLlamaCppConnection(baseUrl = config.llm.baseUrl, timeoutMs = 5000) {
  const url = baseUrl.replace(/\/+$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${url}/models`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: `Backend respondeu com HTTP ${res.status}`
      };
    }

    const data = await res.json().catch(() => ({}));
    return {
      ok: true,
      status: res.status,
      models: data.data || []
    };
  } catch (err) {
    return {
      ok: false,
      error: err.name === 'AbortError' ? 'Timeout de conexão ao llama.cpp' : err.message
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch available models from backend
 */
export async function fetchBackendModels(baseUrl = config.llm.baseUrl) {
  const result = await testLlamaCppConnection(baseUrl);
  if (result.ok && Array.isArray(result.models)) {
    return result.models;
  }
  return [];
}

/**
 * Proxy chat completion request to backend
 */
export async function proxyChatCompletion(payload, options = {}) {
  const baseUrl = (options.baseUrl || config.llm.baseUrl).replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs || config.llm.timeout;
  const isStream = Boolean(payload.stream);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': isStream ? 'text/event-stream' : 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`LLM Backend respondeu HTTP ${response.status}: ${errText.slice(0, 500)}`);
    }

    return response;
  } catch (err) {
    clearTimeout(timer);
    logger.error('Erro ao enviar requisição para o backend LLM', { error: err.message });
    throw err;
  }
}
