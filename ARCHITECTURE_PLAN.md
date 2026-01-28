# Query LLM AI Server Architecture Plan

## Goals
- Provide real-time streaming via two transports:
  - Custom SSE endpoint for the frontend UI event model.
  - Vercel AI SDK-compatible streaming endpoint (Data Stream Protocol).
- Reuse/align conversation, user_context_messages, and agent_context_messages schemas from the backend.
- Provide robust, typed stream events (text, tool-invocation, tool-result, chat-name, chat-complete, error, ping).
- Persist final user/assistant messages and metadata after completion.
- Keep the server scalable, stateless, and maintainable.

## Non-goals (v1)
- Multi-model routing and cost-based optimization.
- Background fine-tuning or long-running batch tasks.
- Full analytics pipeline (keep to structured logs + metrics hooks).

## Guiding principles
- Single streaming core, multiple transports: build once, adapt to SSE and AI SDK.
- Strict schemas at boundaries (request, tool args, and stream events) using Zod.
- Separate orchestration from transport I/O to allow testing and reuse.
- Favor stateless design; persist only on completion or explicit checkpoints.

## High-level flow
1) Request arrives (SSE or AI SDK endpoint).
2) Validate request payload (Zod).
3) Fetch conversation context (backend API or DB models).
4) Create model input (system prompt + context + user message).
5) Run LLM streaming + tool orchestration.
6) Emit typed stream events to client.
7) On completion, persist UI message stream + agent context to backend.

## Service boundaries and data access
Preferred (scalable):
- AI server is stateless; it reads/writes conversation context via backend HTTP APIs.
- Requires adding/confirming backend endpoints for user_context_messages and agent_context_messages updates.

Alternative (tighter coupling):
- AI server connects to MongoDB and uses the same Mongoose models as the backend.
- Copy the backend models directly into the AI server to stay aligned quickly.

## API surface (proposed)
- POST /api/ai/sse
  - Custom SSE response using EventSource-compatible headers.
  - Emits domain-specific events for UI.

- POST /api/ai/stream
  - Vercel AI SDK Data Stream Protocol (SSE) for SDK compatibility.
  - Set `x-vercel-ai-ui-message-stream: v1` for UI message streaming.

- GET /health
  - Basic readiness and dependency status.

## Stream event model (internal)
Discriminated union, emitted by the core, then adapted per transport.

Event types (minimum):
- text: { messageId, delta, isFinal }
- tool-invocation: { toolCallId, toolName, state, args? }
- tool-result: { toolCallId, toolName, result }
- chat-name: { title }
- chat-complete: { messageId, usage?, finishReason }
- error: { code, message, details? }
- ping: { ts }
- status: { phase: 'thinking' | 'tooling' | 'streaming' | 'finalizing' }
- usage: { promptTokens, completionTokens, totalTokens }
- cancel: { reason }

SSE adapter:
- Emit `event: <type>` and `data: <json>`.
- Use `id:` for monotonic event IDs to support reconnection.
- Send periodic `ping` to keep connections open (proxy timeouts).

AI SDK adapter:
- Translate internal events into the Data Stream Protocol.
- Preserve message boundaries and tool call/result semantics.

## Tooling architecture
Tool registry entry:
- name
- description
- parameters (Zod schema)
- execute(args, context) -> result

Examples to implement after approval:
- thought tool: returns structured reasoning blob for UI display.
- calculate tool: safe math evaluation with strict parser and allowed ops.

Notes:
- Validate tool args with Zod before execution.
- Serialize tool results for UI and agent context storage.

## QueryAgent class (core orchestration)
Purpose:
- Centralized orchestration of LLM streaming, tool calls, and event emission.

Responsibilities:
- Build model input from system prompt + context + user message.
- Stream model output and translate to internal events.
- Invoke tools with validated args and emit tool-invocation/tool-result events.
- Collect final UI + agent messages for persistence.

Proposed API:
- constructor(deps: { llmClient, toolRegistry, backendClient, logger })
- run(request, emit) -> Promise<{ uiMessages, agentMessages, usage?, finishReason? }>

Integration:
- Orchestrator instantiates QueryAgent per request.
- SSE/AI SDK adapters consume the same internal event stream.

## Persistence plan
On completion:
- Update conversation title if generated (chat-name event).
- Persist user/assistant UI messages to user_context_messages.
- Persist agent messages (incl. tool calls/results) to agent_context_messages.

Required backend API changes (if stateless AI server):
- POST /api/conversations/:conversation_id/user-context (append/replace)
- POST /api/conversations/:conversation_id/agent-context (append/replace)

## Error handling
- Standard error envelope for all failures.
- Stream error events before closing the connection.
- Retry strategy for transient backend persistence errors.

## Observability
- Request ID and conversation ID in all logs.
- Structured logs (JSON) to capture tool calls and model usage.
- Metrics hooks for latency, tokens, tool calls, and errors.

## Security & safety
- Propagate user auth (JWT) from frontend to AI server and backend.
- Rate limit by user and conversation.
- Tool allowlist only; avoid arbitrary eval.
- Content filtering hooks before persistence.

## Proposed project structure
query-llm-ai/
  src/
    db/models/ (copied from backend)
    app.ts
    routes/
      ai_sse.ts
      ai_stream.ts
      health.ts
    core/
      query_agent.ts
      orchestrator.ts
      stream_events.ts
      adapters/
        sse_adapter.ts
        ai_sdk_adapter.ts
      tools/
        registry.ts
        thought.ts
        calculate.ts
    db/
      repo/
    services/
      backend_client.ts
      llm_client.ts
    types/
      dto.ts
    config/
      env.ts
      logger.ts
  tests/

## Milestones (post-approval)
1) Base Express server + config + health route.
2) Copy the backend models directly into the AI server.
3) QueryAgent + streaming core + tool registry (unit tests).
4) SSE endpoint + UI event mapping.
5) AI SDK endpoint + Data Stream Protocol.
6) Persistence integration + error handling.
7) Integration tests + load/soak checks.

## Open questions / decisions
- Preferred LLM provider + model list? (OpenAI/Anthropic/etc.)
 answer: openai and anthropic
- Stateless (backend API) vs direct DB access?
 answer: stateless (backend API)
- Should message persistence be append-only or replace-by-id?
answer: append-only
- Do we need resumable streams (EventSource Last-Event-ID)?
no we don't need it
- Rate limits and auth: reuse backend auth or issue AI-specific tokens?
answer: reuse backend auth
- Confirm conversation field naming: ai_model vs model (backend/frontend contract alignment).
answer: ai_model

## Best-practice references
- Server-Sent Events fundamentals and reconnection behavior.
- Vercel AI SDK Data Stream Protocol and UI message streaming header.
- Vercel AI SDK streaming + tool execution patterns.
- Zod schemas for validation and parsing.

## References (source links)
- MDN: Using server-sent events (event format, reconnection, keep-alive comments) - https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
- MDN: EventSource (text/event-stream and unidirectional semantics) - https://developer.mozilla.org/en-US/docs/Web/API/EventSource
- Vercel AI SDK UI: Stream Protocol (Data Stream Protocol + UI header) - https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
- Vercel AI SDK Core: streamText (streaming text API) - https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
- Vercel AI SDK Core: Tool Calling (tools, input schemas, tool results) - https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
- Zod: official documentation (parse/safeParse, schema definitions) - https://zod.dev/
