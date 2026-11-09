// gateway/context/tokens.mjs — Token estimation and counting

/**
 * Conservative token estimation.
 * For models using BPE-like tokenizers, ~4 chars per token is a reasonable average.
 * We use 3.5 to be slightly conservative (overestimate token count = safer budget).
 *
 * This is explicitly an approximation. When the backend reports actual token counts,
 * those should be preferred.
 */

const CHARS_PER_TOKEN = 3.5;

export function estimateTokens(text) {
  if (!text) return 0;
  // Handle multimodal content (array of objects)
  if (Array.isArray(text)) {
    let total = 0;
    for (const item of text) {
      if (item.type === 'text' && item.text) {
        total += Math.ceil(item.text.length / CHARS_PER_TOKEN);
      } else if (item.type === 'image_url') {
        // Estimate ~85 tokens per image (conservative)
        total += 85;
      }
    }
    return total;
  }
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateTokensForMessages(messages) {
  let total = 0;
  for (const msg of messages) {
    // ~4 tokens overhead per message (role, delimiters)
    total += 4;
    total += estimateTokens(msg.content || '');
    if (msg.name) total += estimateTokens(msg.name);
    if (msg.tool_calls) {
      const tc = typeof msg.tool_calls === 'string' ? msg.tool_calls : JSON.stringify(msg.tool_calls);
      total += estimateTokens(tc);
    }
  }
  // Add ~3 tokens for the assistant reply primer
  total += 3;
  return total;
}

export function truncateToTokenBudget(text, maxTokens) {
  if (!text) return '';
  const maxChars = Math.floor(maxTokens * CHARS_PER_TOKEN);
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '... [truncated]';
}
