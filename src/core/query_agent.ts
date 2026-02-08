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

    // Track separate message steps for proper agent context structure
    const step_messages: agent_message[] = [];
    let current_step_tool_calls: Array<{ type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }> = [];
    let current_step_text = '';
    let has_seen_tool_result = false;
    let ui_assistant_text = '';

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
        maxSteps: 5, // Allow multiple tool call steps - model can call tools and continue generating responses
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
            current_step_text += delta;
            ui_assistant_text += delta;
            emit({ type: 'text', messageId: assistant_message_id, delta });
          } else if (part.type === 'tool-call') {
            // If we have text before tool calls, save it as an assistant message
            if (current_step_text.trim()) {
              step_messages.push({
                id: create_message_id(),
                role: 'assistant',
                content: current_step_text,
                created_at,
              });
              current_step_text = '';
            }

            // Add tool call to current step
            const toolCallId = part.toolCallId ?? create_message_id();
            const toolName = part.toolName ?? 'tool';
            const args = part.args ?? {};

            current_step_tool_calls.push({ type: 'tool-call', toolCallId, toolName, args });
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

            // When we see the first tool-result, save the assistant message with tool calls
            if (!has_seen_tool_result && current_step_tool_calls.length > 0) {
              step_messages.push({
                id: create_message_id(),
                role: 'assistant',
                content: current_step_tool_calls,
                created_at,
              });
              current_step_tool_calls = [];
              has_seen_tool_result = true;
            }

            // Save tool result as a separate tool message
            step_messages.push({
              id: create_message_id(),
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId,
                  toolName,
                  result: result_data,
                },
              ],
              created_at,
            });

            // Update UI parts
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
            // Note: Not emitting tool-result to frontend - only tool-invocation (UI) is sent
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

        // Save any remaining text as final assistant message
        if (current_step_text.trim()) {
          step_messages.push({
            id: create_message_id(),
            role: 'assistant',
            content: current_step_text,
            created_at,
          });
        }

        // If we still have unsaved tool calls (no results received), save them
        if (current_step_tool_calls.length > 0) {
          step_messages.push({
            id: create_message_id(),
            role: 'assistant',
            content: current_step_tool_calls,
            created_at,
          });
        }

        console.log('[QueryAgent] Stream ended. Total parts:', partCount, 'Steps:', step_messages.length);
      } else if ((result as any).textStream) {
        console.log('[QueryAgent] Using textStream fallback');
        let deltaCount = 0;
        for await (const delta of (result as any).textStream as AsyncIterable<string>) {
          deltaCount++;
          current_step_text += delta;
          ui_assistant_text += delta;
          emit({ type: 'text', messageId: assistant_message_id, delta });
        }
        if (current_step_text.trim()) {
          step_messages.push({
            id: create_message_id(),
            role: 'assistant',
            content: current_step_text,
            created_at,
          });
        }
        console.log('[QueryAgent] TextStream ended. Total deltas:', deltaCount);
      } else {
        console.warn('[QueryAgent] No stream available from result:', Object.keys(result));
      }

      console.log('[QueryAgent] Final UI text length:', ui_assistant_text.length, 'Step messages:', step_messages.length);
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

    // UI messages: simplified view for frontend display
    // Build parts array with tool invocations FIRST, then text
    const ui_message_parts: ui_message['parts'] = [];

    // Add all tool invocations first (display at top)
    if (ui_parts && ui_parts.length > 0) {
      ui_message_parts.push(...ui_parts);
    }

    // Add text content after tool invocations (display below tools)
    if (ui_assistant_text && ui_assistant_text.trim()) {
      ui_message_parts.push({
        type: 'text',
        text: ui_assistant_text,
      });
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
        content: ui_assistant_text || '', // Keep for backward compatibility
        parts: ui_message_parts.length > 0 ? ui_message_parts : undefined,
        created_at,
      },
    ];

    // Agent messages: proper multi-turn structure for context
    // Structure: [user_msg, assistant_msg_with_tool_calls, tool_result_msg, assistant_msg_with_text, ...]
    const user_agent_message: agent_message = {
      id: user_message_id,
      role: 'user',
      content: request.message,
      created_at,
    };

    return {
      ui_messages,
      agent_messages: [user_agent_message, ...step_messages],
      finish_reason,
      usage,
    };
  }
}
