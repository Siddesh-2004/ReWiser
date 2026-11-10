// src/utils/apiErrors.ts
export class ApiError extends Error {
  statusCode: number;
  data: null = null;
  success = false;
  errors: unknown[];

  constructor(
    statusCode: number,
    message = 'Something went wrong',
    errors: unknown[] = [],
    stack = '',
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}