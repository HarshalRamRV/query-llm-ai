export type stream_event =
  | {
      type: 'chat-start';
      conversationId: string;
      messageId: string;
      model: string;
    }
  | {
      type: 'message-start';
      messageId: string;
      role: 'user' | 'assistant' | 'system' | 'tool';
    }
  | {
      type: 'text';
      messageId: string;
      delta: string;
      isFinal?: boolean;
    }
  | {
      type: 'tool-invocation';
      toolCallId: string;
      toolName: string;
      state: 'call' | 'result' | 'partial-call';
      args?: unknown;
      result?: unknown;
    }
  | {
      type: 'tool-result';
      toolCallId: string;
      toolName: string;
      result: unknown;
    }
  | {
      type: 'usage';
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    }
  | {
      type: 'chat-name';
      title: string;
    }
  | {
      type: 'chat-complete';
      messageId: string;
      finishReason?: string;
    }
  | {
      type: 'error';
      code: string;
      message: string;
      details?: unknown;
    }
  | {
      type: 'ping';
      ts: number;
    }
  | {
      type: 'cancel';
      reason?: string;
    };

export type stream_event_handler = (event: stream_event) => void;
