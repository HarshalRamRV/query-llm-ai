import { Request, Response, NextFunction } from 'express';
import { api_error } from '@/utils/api_error';
import { is_production } from '@/config/env';

export const send_error = (
  res: Response,
  code: string,
  message: string,
  status_code: number,
  details?: unknown
): Response => {
  return res.status(status_code).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
  });
};

export const error_middleware = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  if (!is_production) {
    console.error('Error:', error);
  }

  if (error instanceof api_error) {
    return send_error(
      res,
      error.code,
      error.message,
      error.status_code,
      error.details
    );
  }

  if (error.name === 'ValidationError') {
    return send_error(res, 'VALIDATION_ERROR', error.message, 422);
  }

  if (error.name === 'MongoServerError' && (error as unknown as { code: number }).code === 11000) {
    return send_error(res, 'DUPLICATE_KEY', 'A record with this value already exists', 409);
  }

  if (error.name === 'CastError') {
    return send_error(res, 'INVALID_ID', 'Invalid ID format', 400);
  }

  return send_error(
    res,
    'INTERNAL_ERROR',
    is_production ? 'Internal server error' : error.message,
    500
  );
};

export const not_found_middleware = (
  req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  return send_error(res, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`, 404);
};
