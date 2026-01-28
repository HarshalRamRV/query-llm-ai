export class api_error extends Error {
  public readonly status_code: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    status_code: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: unknown
  ) {
    super(message);
    this.status_code = status_code;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';

    Error.captureStackTrace(this, this.constructor);
  }

  static bad_request(message: string, details?: unknown): api_error {
    return new api_error(message, 400, 'BAD_REQUEST', details);
  }

  static unauthorized(message: string = 'Unauthorized'): api_error {
    return new api_error(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Forbidden'): api_error {
    return new api_error(message, 403, 'FORBIDDEN');
  }

  static not_found(message: string = 'Resource not found'): api_error {
    return new api_error(message, 404, 'NOT_FOUND');
  }

  static conflict(message: string, details?: unknown): api_error {
    return new api_error(message, 409, 'CONFLICT', details);
  }

  static validation_error(message: string, details?: unknown): api_error {
    return new api_error(message, 422, 'VALIDATION_ERROR', details);
  }

  static internal_error(message: string = 'Internal server error'): api_error {
    return new api_error(message, 500, 'INTERNAL_ERROR');
  }
}
