import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { backend_client } from '@/services/backend_client';
import { api_error } from '@/utils/api_error';
import { QueryAgent } from '@/core/query_agent';
import type { stream_event } from '@/core/stream_events';
import { logger } from '@/utils/logger';
import { env } from '@/config/env';

const router = Router();

const request_schema = z.object({
  conversation_id: z.string().min(1),
  message: z.string().min(1),
  model: z.string().optional().default('default'),
  system_prompt: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  user_message_id: z.string().optional(),
  assistant_message_id: z.string().optional(),
});

const write_sse_event = (res: Response, event_id: number, event: stream_event) => {
  res.write(`id: ${event_id}\n`);
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
};

const safe_stringify = (value: unknown, max_length = 1000): string => {
  try {
    const text = JSON.stringify(value);
    if (!text) return '';
    return text.length > max_length ? `${text.slice(0, max_length)}…` : text;
  } catch {
    return '';
  }
};

router.post('/sse', async (req: Request, res: Response) => {
  let event_id = 0;
  let stream_open = true;
  let ping_interval: NodeJS.Timeout | null = null;
  const abort_controller = new AbortController();
  const debug_stream = ['1', 'true', 'yes', 'on'].includes(
    (env.AI_DEBUG_STREAM || '').toLowerCase()
  );
  let text_chars = 0;
  let sse_started = false;

  const close_stream = () => {
    if (!stream_open) return;
    stream_open = false;
    if (ping_interval) {
      clearInterval(ping_interval);
      ping_interval = null;
    }
    abort_controller.abort();
    res.end();
  };

  req.on('aborted', () => {
    close_stream();
  });
  res.on('close', () => {
    close_stream();
  });

  try {
    const auth_header = req.headers.authorization;
    if (!auth_header) {
      throw api_error.unauthorized('Authorization header is missing');
    }

    const body = request_schema.parse(req.body);
    logger.info(
      {
        conversation_id: body.conversation_id,
        model: body.model ?? 'default',
        has_system_prompt: Boolean(body.system_prompt),
      },
      'AI SSE request received'
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    sse_started = true;

    const conversation_data = await backend_client.get_conversation(
      body.conversation_id,
      auth_header
    );
    logger.info(
      {
        conversation_id: body.conversation_id,
        agent_messages: conversation_data.agent_context_messages?.length ?? 0,
        user_messages: conversation_data.user_context_messages?.length ?? 0,
      },
      'Backend context loaded'
    );

    ping_interval = setInterval(() => {
      if (!stream_open) return;
      event_id += 1;
      write_sse_event(res, event_id, { type: 'ping', ts: Date.now() });
    }, 15000);

    const agent = new QueryAgent();
    const emit = (event: stream_event) => {
      if (!stream_open) return;
      event_id += 1;
      write_sse_event(res, event_id, event);
      if (debug_stream) {
        if (event.type === 'text') {
          text_chars += event.delta.length;
          logger.info(
            {
              conversation_id: body.conversation_id,
              message_id: event.messageId,
              delta_length: event.delta.length,
              total_chars: text_chars,
            },
            'AI stream text delta'
          );
        } else if (event.type === 'tool-invocation') {
          logger.info(
            {
              conversation_id: body.conversation_id,
              tool_call_id: event.toolCallId,
              tool_name: event.toolName,
              state: event.state,
              args: safe_stringify(event.args, 2000),
            },
            'AI tool invocation'
          );
        } else {
          logger.info(
            {
              conversation_id: body.conversation_id,
              event_type: event.type,
            },
            'AI stream event'
          );
        }
      }
    };

    const agent_context_messages = (conversation_data.agent_context_messages || []).map((msg) => ({
      ...msg,
      created_at: new Date(msg.created_at),
    }));

    const result = await agent.run(
      {
        conversation_id: body.conversation_id,
        message: body.message,
        model: body.model ?? 'default',
        system_prompt: body.system_prompt,
        user_message_id: body.user_message_id,
        assistant_message_id: body.assistant_message_id,
        agent_context_messages,
      },
      emit,
      abort_controller.signal
    );

    await backend_client.append_user_context(
      body.conversation_id,
      result.ui_messages,
      auth_header
    );
    logger.info(
      { conversation_id: body.conversation_id, count: result.ui_messages.length },
      'User context appended'
    );

    await backend_client.append_agent_context(
      body.conversation_id,
      result.agent_messages,
      auth_header
    );
    logger.info(
      { conversation_id: body.conversation_id, count: result.agent_messages.length },
      'Agent context appended'
    );

    close_stream();
  } catch (error) {
    logger.error(
      {
        message: error instanceof Error ? error.message : 'Streaming error',
      },
      'AI SSE failed'
    );
    if (!sse_started && !res.headersSent) {
      const status = error instanceof api_error ? error.status_code : 500;
      res.status(status).json({
        success: false,
        error: {
          code: error instanceof api_error ? error.code : 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      });
      return;
    }

    event_id += 1;
    const message = error instanceof Error ? error.message : 'Streaming error';
    if (stream_open) {
      write_sse_event(res, event_id, {
        type: 'error',
        code: 'STREAM_ERROR',
        message,
      });
    }
    close_stream();
  }
});

export default router;
