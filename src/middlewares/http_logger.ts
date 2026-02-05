import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import pino_http from 'pino-http';
import { logger } from '@/utils/logger';

type authed_request = IncomingMessage & {
  id?: string;
  user?: { _id?: string };
};

export const http_logger = pino_http({
  logger,
  genReqId: (req: IncomingMessage, res: ServerResponse) => {
    const request_id = (req.headers['x-request-id'] as string | undefined) || randomUUID();
    res.setHeader('x-request-id', request_id);
    return request_id;
  },
  customProps: (req: IncomingMessage) => ({
    user_id: (req as authed_request).user?._id,
  }),
  serializers: {
    req: (req: authed_request) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    }),
    res: (res: ServerResponse) => ({
      statusCode: res.statusCode,
    }),
  },
});
