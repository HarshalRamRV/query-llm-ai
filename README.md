# Query LLM AI Server

AI server for Query LLM application providing real-time streaming via Server-Sent Events (SSE) and Vercel AI SDK-compatible endpoints.

## Features

- **Dual Transport Support**
  - Custom SSE endpoint for frontend UI event model
  - Vercel AI SDK-compatible streaming endpoint (Data Stream Protocol)
  
- **Real-time Streaming**
  - Typed stream events (text, tool-invocation, tool-result, chat-name, chat-complete, error, ping)
  - Robust event handling with discriminated unions
  
- **Tool Orchestration**
  - Tool registry with Zod-validated parameters
  - Support for custom tools (thought, calculate, etc.)
  
- **Stateless Architecture**
  - Scalable, stateless design
  - Backend API integration for conversation context
  - Message persistence on completion

## Architecture

The server follows a single streaming core with multiple transport adapters:

1. **Request Flow**
   - Request arrives (SSE or AI SDK endpoint)
   - Validate request payload (Zod)
   - Fetch conversation context (backend API)
   - Create model input (system prompt + context + user message)
   - Run LLM streaming + tool orchestration
   - Emit typed stream events to client
   - On completion, persist UI message stream + agent context to backend

2. **Core Components**
   - `QueryAgent`: Centralized orchestration of LLM streaming, tool calls, and event emission
   - Transport adapters: SSE adapter and AI SDK adapter
   - Tool registry: Validated tool execution with Zod schemas

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (for database access via backend API)
- Backend API server running

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
   - Database connection settings
   - Backend API URL
   - LLM provider API keys (OpenAI/Anthropic)

### Running the Server

Development mode (with hot reload):
```bash
npm run dev
```

Build and run production:
```bash
npm run build
npm start
```

## API Endpoints

### POST /api/ai/sse
Custom SSE endpoint for frontend UI event model.
- Emits domain-specific events for UI
- Uses EventSource-compatible headers
- Supports reconnection with monotonic event IDs

### POST /api/ai/stream
Vercel AI SDK Data Stream Protocol endpoint.
- Compatible with Vercel AI SDK
- Set `x-vercel-ai-ui-message-stream: v1` header for UI message streaming

### GET /health
Health check endpoint.
- Returns readiness and dependency status

## Stream Event Model

Internal event types:
- `text`: { messageId, delta, isFinal }
- `tool-invocation`: { toolCallId, toolName, state, args? }
- `tool-result`: { toolCallId, toolName, result }
- `chat-name`: { title }
- `chat-complete`: { messageId, usage?, finishReason }
- `error`: { code, message, details? }
- `ping`: { ts }
- `status`: { phase: 'thinking' | 'tooling' | 'streaming' | 'finalizing' }
- `usage`: { promptTokens, completionTokens, totalTokens }
- `cancel`: { reason }

## Project Structure

```
query-llm-ai/
  src/
    db/
      models/          # Database models (copied from backend)
      mg_db.ts         # MongoDB connection
    config/
      env.ts           # Environment configuration
      database.ts      # Database configuration
    routes/
      health.ts        # Health check route
    middlewares/
      error_middleware.ts  # Error handling middleware
    utils/
      api_error.ts     # API error utilities
    app.ts             # Express app entry point
```

## Development

### Scripts

- `npm run dev` - Start development server with nodemon
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production server
- `npm run lint` - Run ESLint

### Key Design Decisions

- **LLM Providers**: OpenAI and Anthropic
- **Architecture**: Stateless (backend API integration)
- **Message Persistence**: Append-only
- **Stream Resumption**: Not required
- **Authentication**: Reuse backend auth (JWT)
- **Conversation Field**: `ai_model` (not `model`)

## Security & Safety

- User authentication via JWT propagation from frontend
- Rate limiting by user and conversation
- Tool allowlist only (no arbitrary eval)
- Content filtering hooks before persistence

## Observability

- Request ID and conversation ID in all logs
- Structured JSON logs
- Metrics hooks for latency, tokens, tool calls, and errors

## References

- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [Vercel AI SDK Stream Protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)
- [Vercel AI SDK Core: streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [Vercel AI SDK Core: Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Zod Documentation](https://zod.dev/)

## License

ISC
