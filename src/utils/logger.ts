import pino from 'pino';
import { is_production } from '@/config/env';

const transport = !is_production
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    })
  : undefined;

export const logger = pino(
  {
    level: 'info',
    base: { service: 'query-llm-ai' },
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  },
  transport
);
