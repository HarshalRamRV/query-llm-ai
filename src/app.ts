import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from '@/config/env';
import { connect_database } from '@/config/database';
import health_routes from '@/routes/health';
import { error_middleware, not_found_middleware } from '@/middlewares/error_middleware';

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/health', health_routes);

app.use(not_found_middleware);
app.use(error_middleware);

const start_server = async (): Promise<void> => {
  try {
    await connect_database();

    app.listen(env.PORT, () => {
      console.log(`AI server running on port ${env.PORT}`);
      console.log(`Environment: ${env.NODE_ENV}`);
      console.log(`Health check: http://localhost:${env.PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start_server();

export default app;
