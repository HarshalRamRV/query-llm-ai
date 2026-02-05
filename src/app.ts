import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from '@/config/env';
import health_routes from '@/routes/health';
import { error_middleware, not_found_middleware } from '@/middlewares/error_middleware';
import { http_logger } from '@/middlewares/http_logger';
import ai_sse_routes from '@/routes/ai_sse';
import ai_stream_routes from '@/routes/ai_stream';

const app = express();

app.use(helmet());

app.use(http_logger);

app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/health', health_routes);
app.use('/api/ai', ai_sse_routes);
app.use('/api/ai', ai_stream_routes);

app.use(not_found_middleware);
app.use(error_middleware);

app.listen(env.PORT, () => {
  console.log(`AI server running on port ${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Health check: http://localhost:${env.PORT}/api/health`);
});

export default app;
