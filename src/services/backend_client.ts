import { env } from '@/config/env';
import { api_error } from '@/utils/api_error';

const normalize_base = (url: string): string => url.replace(/\/+$/, '');

const backend_base = normalize_base(env.BACKEND_API_URL);

type request_options = {
  method?: string;
  body?: unknown;
  token: string;
};

const backend_request = async <T>(path: string, options: request_options): Promise<T> => {
  const response = await fetch(`${backend_base}/api${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: options.token,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload || payload.success === false) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `Backend request failed with status ${response.status}`;
    const code = payload?.error?.code || 'BACKEND_ERROR';
    throw new api_error(message, response.status || 500, code, payload?.error?.details);
  }

  return payload.data as T;
};

export type backend_conversation_response = {
  conversation: {
    conversation_id: string;
    title: string;
    ai_model: string;
    updated_at: string;
  };
  user_context_messages: Array<{
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
    created_at: string;
  }>;
  agent_context_messages: Array<{
    id: string;
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: unknown;
    created_at: string;
  }>;
};

const sanitize_ui_message = (message: any) => ({
  ...message,
  content: typeof message?.content === 'string' ? message.content : '',
  parts: message?.role === 'assistant' ? message?.parts ?? [] : undefined,
});

export const backend_client = {
  get_conversation: async (
    conversation_id: string,
    token: string
  ): Promise<backend_conversation_response> => {
    return backend_request(`/conversations/${conversation_id}`, { token });
  },
  append_user_context: async (conversation_id: string, messages: unknown[], token: string) => {
    const sanitized = (messages as any[]).map(sanitize_ui_message);
    return backend_request(`/conversations/${conversation_id}/user-context/append`, {
      method: 'POST',
      token,
      body: { messages: sanitized },
    });
  },
  append_agent_context: async (conversation_id: string, messages: unknown[], token: string) => {
    return backend_request(`/conversations/${conversation_id}/agent-context/append`, {
      method: 'POST',
      token,
      body: { messages },
    });
  },
  update_conversation: async (
    conversation_id: string,
    payload: { title?: string; model?: string; status?: 'active' | 'archived' },
    token: string
  ) => {
    return backend_request(`/conversations/${conversation_id}`, {
      method: 'PATCH',
      token,
      body: payload,
    });
  },
};
