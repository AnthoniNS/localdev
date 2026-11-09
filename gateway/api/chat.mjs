// gateway/api/chat.mjs — OpenAI-compatible /v1/chat/completions with auto project detection, tool calling, and context checkpoints

import crypto from 'node:crypto';
import config from '../config.mjs';
import logger from '../logger.mjs';
import { buildContext } from '../context/builder.mjs';
import { estimateTokens } from '../context/tokens.mjs';
import { addMessage, createConversation, getConversation, updateConversation } from '../conversations/manager.mjs';
import { resolveOrCreateProject } from '../projects/detector.mjs';
import { proxyChatCompletion } from '../llm/proxy.mjs';
import { resolveModelId } from '../llm/models-cache.mjs';
import { listAvailableTools, executeTool } from '../tools/manager.mjs';
import { detectMaxContext, evaluateContextUsage } from '../context/manager.mjs';
import { getActiveTask, createTask, saveCheckpoint, continueTaskInNewSession } from '../tasks/manager.mjs';

/**
 * Format tools for OpenAI specification
 */
function getOpenAITools() {
  const tools = listAvailableTools();
  return tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  }));
}

/**
 * Poda de contexto: trunca resultados de ferramentas grandes e antigos.
 * Mantém os 3 últimos resultados de ferramenta completos; os demais são truncados.
 * Isso evita que cada turno fique progressivamente mais lento por acúmulo de contexto.
 */
function pruneContextForModel(messages) {
  const MAX_TOOL_CONTENT_CHARS = 4000;
  const KEEP_RECENT = 3;

  const recentToolIndices = new Set();
  let toolCountFromEnd = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'tool') {
      toolCountFromEnd++;
      if (toolCountFromEnd <= KEEP_RECENT) recentToolIndices.add(i);
    }
  }

  return messages.map((m, idx) => {
    if (m.role === 'tool' && typeof m.content === 'string' && m.content.length > MAX_TOOL_CONTENT_CHARS && !recentToolIndices.has(idx)) {
      return { ...m, content: m.content.slice(0, MAX_TOOL_CONTENT_CHARS) + '\n\n[... resultado truncado para economia de contexto ...]' };
    }
    return m;
  });
}

/**
 * Handle OpenAI-compatible chat completions
 */
export async function handleChatCompletions(req, res, body) {
  const isStream = Boolean(body.stream);
  const requestedModel = body.model || config.llm.defaultModel || 'local-model';
  const modelName = await resolveModelId(requestedModel);
  const incomingMessages = Array.isArray(body.messages) ? body.messages : [];

  logger.info('Modelo resolvido', { requested: requestedModel, resolved: modelName });

  if (incomingMessages.length === 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: { message: 'Nenhuma mensagem foi fornecida.', type: 'invalid_request_error' } }));
  }

  // 1. Auto-detect or resolve project from workspace headers/body
  const project = resolveOrCreateProject(req, body);
  const projectId = project?.id || null;
  const workDir = project?.workDir || process.cwd();

  // 2. Identify or create task
  let activeTask = projectId ? getActiveTask(projectId) : null;
  const lastUserMsg = incomingMessages.filter(m => m.role === 'user').pop();
  // Extract text from multimodal content or use string directly
  let userQuery = '';
  if (lastUserMsg) {
    if (typeof lastUserMsg.content === 'string') {
      userQuery = lastUserMsg.content;
    } else if (Array.isArray(lastUserMsg.content)) {
      // Extract text parts from multimodal content
      userQuery = lastUserMsg.content
        .filter(part => part.type === 'text' && part.text)
        .map(part => part.text)
        .join(' ');
    }
  }

  if (!activeTask && projectId && userQuery) {
    activeTask = createTask({
      projectId,
      title: userQuery.slice(0, 45) || 'Tarefa de Desenvolvimento',
      objective: userQuery
    });
  }

  // 3. Identify or create conversation
  let conversationId = req.headers['x-conversation-id'] || body.conversation_id || null;
  if (conversationId) {
    const existing = getConversation(conversationId);
    if (!existing && projectId) {
      createConversation({ id: conversationId, projectId, model: modelName });
    }
  } else if (projectId) {
    if (activeTask && activeTask.currentSessionId) {
      conversationId = activeTask.currentSessionId;
    } else {
      const conv = createConversation({
        projectId,
        model: modelName,
        title: userQuery.slice(0, 35) || 'Nova Conversa'
      });
      conversationId = conv.id;
      if (activeTask) {
        activeTask.currentSessionId = conv.id;
      }
    }
  }

  // 4. Save user message in conversation
  if (conversationId && projectId && lastUserMsg) {
    addMessage({
      conversationId,
      projectId,
      role: 'user',
      content: userQuery,
      tokensEstimated: estimateTokens(userQuery)
    });
  }

  // 5. Build context with token budget and individual project system prompt
  let contextMessages = incomingMessages;
  const availableTools = getOpenAITools();

  if (projectId) {
    try {
      const built = await buildContext({
        projectId,
        conversationId,
        messages: incomingMessages,
        model: modelName,
        tools: availableTools
      });
      contextMessages = built.messages;
    } catch (err) {
      logger.warn('Aviso na construção de contexto', { error: err.message });
    }
  }

  const completionId = `chatcmpl-${crypto.randomUUID()}`;
  const createdTimestamp = Math.floor(Date.now() / 1000);

  // 6. Tools loop: allow up to 15 iterative tool calling turns before finishing
  const MAX_TOOL_TURNS = 15;
  let currentMessages = [...contextMessages];
  let turn = 0;
  let backendResponded = false;

  try {
    while (turn < MAX_TOOL_TURNS) {
      turn++;
      currentMessages = pruneContextForModel(currentMessages);

      // Evaluate context tokens before calling model
      const totalEstimatedTokens = estimateTokens(JSON.stringify(currentMessages));
      const maxCtx = await detectMaxContext();
      const ctxEval = evaluateContextUsage(totalEstimatedTokens, maxCtx);

      // Checkpoint trigger if nearing context limit
      if (ctxEval.needsCheckpoint && activeTask) {
        saveCheckpoint(activeTask.id, {
          sessionId: conversationId,
          objective: activeTask.objective || userQuery,
          nextAction: 'Continuar resposta técnica no próximo turno',
          contextTokenUsage: totalEstimatedTokens
        });
      }

      const payload = {
        ...body,
        model: modelName,
        messages: currentMessages,
        tools: body.tools || availableTools,
        stream: false // Forçamos false no upstream para parsear tool_calls com segurança e evitar que o cliente intercepte
      };

      let upstreamResponse;
      try {
      logger.info('Enviando requisição para o backend LLM', { 
        url: config.llm.baseUrl, 
        model: modelName,
        stream: payload.stream,
        timeoutMs: config.llm.timeout,
        messageCount: payload.messages?.length,
        hasImages: payload.messages?.some(m => 
          Array.isArray(m.content) && m.content.some(c => c.type === 'image_url')
        )
      });
      
      // Log detalhado se houver imagens
      if (payload.messages?.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image_url'))) {
        logger.info('Mensagem multimodal detectada', {
          totalMessages: payload.messages.length,
          lastMessage: JSON.stringify(payload.messages[payload.messages.length - 1])
        });
      }
      
      const requestStartTime = Date.now();
      upstreamResponse = await proxyChatCompletion(payload, { timeoutMs: config.llm.timeout });
      const requestDuration = Date.now() - requestStartTime;
      logger.info('Resposta recebida do backend', { 
        status: upstreamResponse.status, 
        ok: upstreamResponse.ok,
        duration: requestDuration
      });
      } catch (upstreamErr) {
        logger.error('Erro ao conectar com o backend LLM', { 
          error: upstreamErr.message,
          stack: upstreamErr.stack 
        });
        // If llama.cpp is offline, break and fallback
        break;
      }

      let responseData;
      try {
        responseData = await upstreamResponse.json();
        backendResponded = true;
        logger.info('Resposta parseada com sucesso', { 
          hasChoices: !!responseData.choices,
          choicesCount: responseData.choices?.length || 0 
        });
      } catch (parseErr) {
        logger.error('Erro ao parsear resposta JSON do backend', { 
          error: parseErr.message,
          responseText: await upstreamResponse.text().catch(() => 'não disponível')
        });
        break;
      }
      
      const choice = responseData.choices?.[0];
      const message = choice?.message || {};

      // Se o modelo solicitou chamada de ferramenta, executamos e continuamos o loop
      if (message.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
        logger.info('Tool calls detectadas', { 
          turn, 
          count: message.tool_calls.length,
          tools: message.tool_calls.map(c => c.function?.name)
        });
        
        currentMessages.push(message);

        // Execute each tool call for real
        for (let i = 0; i < message.tool_calls.length; i++) {
          const call = message.tool_calls[i];
          const fnName = call.function?.name;
          let fnArgs = {};
          try {
            fnArgs = JSON.parse(call.function?.arguments || '{}');
          } catch (parseErr) {
            logger.error('Erro ao parsear argumentos da ferramenta', { 
              tool: fnName, 
              args: call.function?.arguments,
              error: parseErr.message 
            });
          }

          logger.info(`Executando ferramenta ${i + 1}/${message.tool_calls.length}`, { 
            tool: fnName, 
            args: fnArgs,
            turn,
            messageCount: currentMessages.length
          });

          const toolStartTime = Date.now();
          let execResult;
          
          try {
            const toolTimeout = 60000;
            execResult = await Promise.race([
              executeTool(fnName, fnArgs, {
                projectId,
                conversationId,
                workDir
              }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Timeout de ${toolTimeout}ms`)), toolTimeout)
              )
            ]);
          } catch (toolErr) {
            logger.error(`Erro na ferramenta ${fnName}`, { error: toolErr.message });
            execResult = { ok: false, error: toolErr.message };
          }
          
          const toolDuration = Date.now() - toolStartTime;

          logger.info('Ferramenta executada', { 
            tool: fnName, 
            ok: execResult.ok,
            duration: toolDuration,
            turn
          });

          const toolResultString = JSON.stringify(execResult.ok ? execResult.result : { error: execResult.error });

          currentMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: fnName,
            content: toolResultString
          });

          if (conversationId && projectId) {
            addMessage({
              conversationId,
              projectId,
              role: 'tool',
              name: fnName,
              toolCallId: call.id,
              content: toolResultString,
              tokensEstimated: estimateTokens(toolResultString)
            });
          }
        }

        logger.info('Todas as ferramentas executadas, continuando loop', { 
          turn, 
          nextTurn: turn + 1,
          messageCount: currentMessages.length
        });

        // Loop continues to let LLM analyze tool outputs
        continue;
      }

      // Resposta final do assistente alcançada (sem mais tool calls)
      const assistantContent = message.content || '';

      // Check if new session should be prepared for the task
      if (ctxEval.needsNewSession && activeTask) {
        logger.info('Contexto atingiu threshold de nova sessão, preparando transição', { ratio: ctxEval.ratio });
        saveCheckpoint(activeTask.id, {
          sessionId: conversationId,
          objective: activeTask.objective || userQuery,
          completedSteps: ['Etapa concluída na sessão anterior'],
          nextAction: 'Prosseguir com a próxima instrução solicitada pelo usuário',
          contextTokenUsage: totalEstimatedTokens
        });
        const transition = await continueTaskInNewSession(activeTask.id);
        if (transition && transition.newSessionId) {
          conversationId = transition.newSessionId;
        }
      }

      // Enviamos a resposta final para o cliente. Se o cliente pediu streaming, simulamos o stream do texto final.
      // Isso garante que o cliente (ex: Continue) NUNCA veja a chamada de ferramenta bruta, apenas a resposta processada.
      if (isStream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'x-conversation-id': conversationId || '',
          'x-project-id': projectId || ''
        });

        const chunk = {
          id: completionId,
          object: 'chat.completion.chunk',
          created: createdTimestamp,
          model: modelName,
          choices: [{ index: 0, delta: { role: 'assistant', content: assistantContent }, finish_reason: 'stop' }]
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseData));
      }

      if (conversationId && projectId && assistantContent) {
        addMessage({
          conversationId,
          projectId,
          role: 'assistant',
          content: assistantContent,
          tokensEstimated: estimateTokens(assistantContent)
        });
      }

      return;
    }
  } catch (loopErr) {
    logger.warn('Erro durante loop de execução do modelo', { error: loopErr.message });
  }

  // Se o loop terminou por limite de turnos mas o backend estava respondendo,
  // solicita um resumo final em vez de retornar o fallback de erro enganoso.
  if (backendResponded && turn >= MAX_TOOL_TURNS) {
    logger.info('Limite de turnos atingido, solicitando resumo final ao modelo', { turn });
    try {
      currentMessages = pruneContextForModel(currentMessages);
      currentMessages.push({
        role: 'user',
        content: 'Limite de etapas atingido. Sem usar nenhuma ferramenta, resuma em poucas linhas: o que já foi feito, quais arquivos foram criados ou modificados e qual é o próximo passo pendente.'
      });
      const summaryPayload = { model: modelName, messages: currentMessages, stream: false };
      const summaryResponse = await proxyChatCompletion(summaryPayload, { timeoutMs: config.llm.timeout });
      const summaryData = await summaryResponse.json();
      const summaryContent = summaryData.choices?.[0]?.message?.content || 'Tarefa executada em múltiplas etapas. Verifique os arquivos criados na pasta workspaces/ do projeto.';

      if (conversationId && projectId && summaryContent) {
        addMessage({ conversationId, projectId, role: 'assistant', content: summaryContent, tokensEstimated: estimateTokens(summaryContent) });
      }

      if (isStream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'x-conversation-id': conversationId || ''
        });
        res.write(`data: ${JSON.stringify({ id: completionId, object: 'chat.completion.chunk', created: createdTimestamp, model: modelName, choices: [{ index: 0, delta: { role: 'assistant', content: summaryContent }, finish_reason: 'stop' }] })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        id: completionId, object: 'chat.completion', created: createdTimestamp, model: modelName,
        choices: [{ index: 0, message: { role: 'assistant', content: summaryContent }, finish_reason: 'stop' }]
      }));
    } catch (summaryErr) {
      logger.warn('Falha ao gerar resumo final', { error: summaryErr.message });
    }
  }

  // Fallback: diferencia backend offline de limite de turnos atingido
  const fallbackText = backendResponded
    ? `[LocalDevAI Gateway]: A tarefa excedeu o limite de ${MAX_TOOL_TURNS} etapas de processamento. Parte do trabalho pode ter sido concluída — verifique a pasta workspaces/ do projeto.`
    : `[LocalDevAI Gateway]: O backend llama.cpp não respondeu em ${config.llm.baseUrl}. O Gateway, Search e Tooling estão operacionais. Inicie o llama.cpp ou consulte o painel em /admin.`;

  if (isStream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'x-conversation-id': conversationId || ''
    });

    const chunk = {
      id: completionId,
      object: 'chat.completion.chunk',
      created: createdTimestamp,
      model: modelName,
      choices: [{ index: 0, delta: { role: 'assistant', content: fallbackText }, finish_reason: null }]
    };
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);

    const endChunk = {
      id: completionId,
      object: 'chat.completion.chunk',
      created: createdTimestamp,
      model: modelName,
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
    };
    res.write(`data: ${JSON.stringify(endChunk)}\n\n`);
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    id: completionId,
    object: 'chat.completion',
    created: createdTimestamp,
    model: modelName,
    choices: [{
      index: 0,
      message: { role: 'assistant', content: fallbackText },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: estimateTokens(JSON.stringify(contextMessages)),
      completion_tokens: estimateTokens(fallbackText),
      total_tokens: estimateTokens(JSON.stringify(contextMessages)) + estimateTokens(fallbackText)
    }
  }));
}
