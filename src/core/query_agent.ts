import { streamText } from 'ai';
import { randomUUID } from 'crypto';
import { env } from '@/config/env';
import { resolve_model } from '@/core/model_resolver';
import { tool_registry } from '@/tools/registry';
import type { stream_event_handler } from '@/core/stream_events';

type agent_message = {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: unknown;
  created_at: Date;
};

type ui_message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parts?: Array<{
    type: 'text' | 'tool-invocation';
    text?: string;
    toolCallId?: string;
    toolName?: string;
    state?: 'call' | 'result' | 'partial-call';
    args?: unknown;
    result?: unknown;
  }>;
  created_at: Date;
};

export type query_agent_request = {
  conversation_id: string;
  message: string;
  model: string;
  system_prompt?: string;
  user_message_id?: string;
  assistant_message_id?: string;
  agent_context_messages: agent_message[];
};

export type query_agent_result = {
  ui_messages: ui_message[];
  agent_messages: agent_message[];
  finish_reason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

const create_message_id = (): string => `msg_${randomUUID()}`;

const push_text_part = (
  parts: Array<{ type: 'text'; text: string } | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }>,
  delta: string
) => {
  const last = parts[parts.length - 1];
  if (last && last.type === 'text') {
    last.text += delta;
  } else {
    parts.push({ type: 'text', text: delta });
  }
};

export class QueryAgent {
  async run(
    request: query_agent_request,
    emit: stream_event_handler,
    abort_signal?: AbortSignal
  ): Promise<query_agent_result> {
    const user_message_id = request.user_message_id ?? create_message_id();
    const assistant_message_id = request.assistant_message_id ?? create_message_id();
    const created_at = new Date();

    const { provider, model_name, model } = resolve_model(request.model, env.DEFAULT_MODEL);
    console.log('[QueryAgent] Resolved model:', { provider, model_name, requested: request.model });

    emit({
      type: 'chat-start',
      conversationId: request.conversation_id,
      messageId: assistant_message_id,
      model: `${request.model === 'default' ? env.DEFAULT_MODEL : request.model}`,
    });

    emit({
      type: 'message-start',
      messageId: assistant_message_id,
      role: 'assistant',
    });

    const agent_messages: agent_message[] = [...request.agent_context_messages];

    if (request.system_prompt) {
      agent_messages.unshift({
        id: create_message_id(),
        role: 'system',
        content: request.system_prompt,
        created_at,
      });
    }

    agent_messages.push({
      id: user_message_id,
      role: 'user',
      content: request.message,
      created_at,
    });

    const model_messages = agent_messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const ui_parts: ui_message['parts'] = [];
    const assistant_parts: Array<
      { type: 'text'; text: string } | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
    > = [];
    const tool_results: Array<{ toolCallId: string; toolName: string; result: unknown }> = [];
    let assistant_text = '';
    let finish_reason: string | undefined;
    let usage:
      | {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        }
      | undefined;

    try {
      console.log('[QueryAgent] Starting streamText with model:', model_name);
      const result = await streamText({
        model: model as any,
        messages: model_messages as any,
        tools: tool_registry as any,
        abortSignal: abort_signal,
      } as any);

      const full_stream = (result as any).fullStream || (result as any).stream;
      console.log('[QueryAgent] Stream type:', full_stream ? 'fullStream' : 'textStream or none');

      if (full_stream) {
        let partCount = 0;
        for await (const part of full_stream as AsyncIterable<any>) {
          partCount++;
          console.log(`[QueryAgent] Stream part ${partCount}:`, part.type, part);
          if (part.type === 'text-delta') {
            const delta = part.textDelta ?? '';
            assistant_text += delta;
            push_text_part(assistant_parts, delta);
            emit({ type: 'text', messageId: assistant_message_id, delta });
          } else if (part.type === 'tool-call') {
            const toolCallId = part.toolCallId ?? create_message_id();
            const toolName = part.toolName ?? 'tool';
            const args = part.args ?? {};

            assistant_parts.push({ type: 'tool-call', toolCallId, toolName, args });
            ui_parts?.push({
              type: 'tool-invocation',
              toolCallId,
              toolName,
              state: 'call',
              args,
            });
            emit({
              type: 'tool-invocation',
              toolCallId,
              toolName,
              state: 'call',
              args,
            });
          } else if (part.type === 'tool-result') {
            const toolCallId = part.toolCallId ?? create_message_id();
            const toolName = part.toolName ?? 'tool';
            const result_data = part.result;

            tool_results.push({ toolCallId, toolName, result: result_data });
            if (ui_parts) {
              const index = ui_parts.findIndex(
                (item) => item.type === 'tool-invocation' && item.toolCallId === toolCallId
              );
              if (index >= 0) {
                ui_parts[index] = {
                  ...ui_parts[index],
                  state: 'result',
                  result: result_data,
                };
              } else {
                ui_parts.push({
                  type: 'tool-invocation',
                  toolCallId,
                  toolName,
                  state: 'result',
                  result: result_data,
                });
              }
            }
            emit({ type: 'tool-result', toolCallId, toolName, result: result_data });
          } else if (part.type === 'finish') {
            finish_reason = part.finishReason;
            if (part.usage) {
              usage = {
                promptTokens: part.usage.promptTokens ?? 0,
                completionTokens: part.usage.completionTokens ?? 0,
                totalTokens: part.usage.totalTokens ?? 0,
              };
              emit({ type: 'usage', ...usage });
            }
          }
        }
        console.log('[QueryAgent] Stream ended. Total parts:', partCount, 'Text length:', assistant_text.length);
      } else if ((result as any).textStream) {
        console.log('[QueryAgent] Using textStream fallback');
        let deltaCount = 0;
        for await (const delta of (result as any).textStream as AsyncIterable<string>) {
          deltaCount++;
          assistant_text += delta;
          push_text_part(assistant_parts, delta);
          emit({ type: 'text', messageId: assistant_message_id, delta });
        }
        console.log('[QueryAgent] TextStream ended. Total deltas:', deltaCount);
      } else {
        console.warn('[QueryAgent] No stream available from result:', Object.keys(result));
      }

      console.log('[QueryAgent] Final assistant text length:', assistant_text.length);
      emit({
        type: 'chat-complete',
        messageId: assistant_message_id,
        finishReason: finish_reason,
      });
    } catch (error) {
      console.error('[QueryAgent] Stream error:', error);
      if (abort_signal?.aborted) {
        console.log('[QueryAgent] Stream aborted by client');
        emit({ type: 'cancel', reason: 'client_aborted' });
        finish_reason = 'cancelled';
      } else {
        console.error('[QueryAgent] Stream error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          error
        });
        emit({
          type: 'error',
          code: 'STREAM_ERROR',
          message: error instanceof Error ? error.message : 'Streaming error',
        });
        throw error;
      }
    }

    const ui_messages: ui_message[] = [
      {
        id: user_message_id,
        role: 'user',
        content: request.message,
        created_at,
      },
      {
        id: assistant_message_id,
        role: 'assistant',
        content: assistant_text || '',
        parts: ui_parts && ui_parts.length > 0 ? ui_parts : undefined,
        created_at,
      },
    ];

    const assistant_message: agent_message = {
      id: assistant_message_id,
      role: 'assistant',
      content: assistant_parts.length > 0 ? assistant_parts : assistant_text,
      created_at,
    };

    const tool_messages: agent_message[] = tool_results.map((tool_result) => ({
      id: create_message_id(),
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: tool_result.toolCallId,
          toolName: tool_result.toolName,
          result: tool_result.result,
        },
      ],
      created_at,
    }));

    return {
      ui_messages,
      agent_messages: [agent_messages[agent_messages.length - 1], assistant_message, ...tool_messages],
      finish_reason,
      usage,
    };
  }
}
