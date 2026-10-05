/**
 * Custom Error Classes
 * 
 * WHY: Express has no built-in way to throw typed HTTP errors.
 * By creating custom error classes, any module can throw an error like:
 * 
 *   throw new NotFoundError('Project not found');
 * 
 * And our global error middleware (error.middleware.ts) catches it,
 * extracts the status code, and sends a consistent JSON response:
 * 
 *   { "success": false, "error": { "code": "NOT_FOUND", "message": "Project not found" } }
 * 
 * HOW IT WORKS:
 * - AppError is the base class with statusCode and error code
 * - Specific errors (NotFound, BadRequest, etc.) extend AppError
 * - The error middleware checks: if it's an AppError, use its statusCode;
 *   otherwise, default to 500 Internal Server Error
 */

/**
 * Base application error — all custom errors extend this.
 * 
 * @param statusCode - HTTP status code (400, 401, 403, 404, 409, 500)
 * @param code - Machine-readable error code (e.g., "PROJECT_NOT_FOUND")
 * @param message - Human-readable error description
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public isOperational: boolean;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    // isOperational = true means this is an expected error (bad input, not found, etc.)
    // isOperational = false would mean a programming bug — we should crash and restart
    this.isOperational = true;

    // Maintains proper stack trace in V8 (the JS engine)
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Specific Error Classes ───────────────────────────────────

/** 400 Bad Request — invalid input, validation failure */
export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST') {
    super(400, code, message);
  }
}

/** 401 Unauthorized — missing or invalid authentication */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(401, code, message);
  }
}

/** 403 Forbidden — authenticated but not allowed to access this resource */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

/** 404 Not Found — resource doesn't exist */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(404, code, message);
  }
}

/** 409 Conflict — duplicate resource, already exists */
export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', code = 'CONFLICT') {
    super(409, code, message);
  }
}

/** 410 Gone — resource existed but is no longer available (e.g., expired QR) */
export class GoneError extends AppError {
  constructor(message = 'Resource is no longer available', code = 'GONE') {
    super(410, code, message);
  }
}

/** 422 Unprocessable Entity — request is syntactically valid but semantically wrong */
export class ValidationError extends AppError {
  public readonly details: Record<string, string[]>;

  constructor(message = 'Validation failed', details: Record<string, string[]> = {}) {
    super(422, 'VALIDATION_ERROR', message);
    this.details = details;
  }
}

/** 429 Too Many Requests — rate limit exceeded */
export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests, please try again later') {
    super(429, 'TOO_MANY_REQUESTS', message);
  }
}

/** 500 Internal Server Error — something unexpected went wrong */
export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(500, 'INTERNAL_ERROR', message);
    this.isOperational = false; // This is a bug, not an expected error
  }
}
