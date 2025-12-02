import logger from "./logger";

export enum ErrorCode {
  // Authentication Errors (1000-1999)
  INVALID_CREDENTIALS = "AUTH_001",
  TOKEN_EXPIRED = "AUTH_002",
  TOKEN_INVALID = "AUTH_003",
  UNAUTHORIZED = "AUTH_004",
  FORBIDDEN = "AUTH_005",
  USER_NOT_FOUND = "AUTH_006",
  USER_ALREADY_EXISTS = "AUTH_007",
  INVALID_PASSWORD = "AUTH_008",
  PASSWORD_RESET_FAILED = "AUTH_009",
  REFRESH_TOKEN_EXPIRED = "AUTH_010",

  // Organization Errors (2000-2999)
  ORG_NOT_FOUND = "ORG_001",
  ORG_ALREADY_EXISTS = "ORG_002",
  INVALID_ORG_CODE = "ORG_003",
  ORG_CREATION_FAILED = "ORG_004",
  MANAGER_NOT_ASSIGNED = "ORG_005",
  JOINING_ORG_FAILED = "ORG_006",

  // Project Errors (3000-3999)
  PROJECT_NOT_FOUND = "PROJ_001",
  PROJECT_CREATION_FAILED = "PROJ_002",
  INVALID_PROJECT_TYPE = "PROJ_003",
  PROJECT_ALREADY_EXISTS = "PROJ_004",

  // CSV Import Errors (4000-4999)
  CSV_PARSE_ERROR = "CSV_001",
  CSV_INVALID_FORMAT = "CSV_002",
  CSV_DUPLICATE_EMAILS = "CSV_003",
  CSV_IMPORT_FAILED = "CSV_004",
  INVALID_CSV_HEADERS = "CSV_005",

  // Validation Errors (5000-5999)
  VALIDATION_ERROR = "VAL_001",
  INVALID_EMAIL = "VAL_002",
  INVALID_PASSWORD_FORMAT = "VAL_003",
  REQUIRED_FIELD_MISSING = "VAL_004",
  INVALID_COUNTRY = "VAL_005",

  // Database Errors (6000-6999)
  DATABASE_ERROR = "DB_001",
  TRANSACTION_FAILED = "DB_002",
  RECORD_NOT_FOUND = "DB_003",
  DUPLICATE_RECORD = "DB_004",

  // Server Errors (7000-7999)
  INTERNAL_SERVER_ERROR = "SERVER_001",
  SERVICE_UNAVAILABLE = "SERVER_002",
  REQUEST_TIMEOUT = "SERVER_003",

  // File Upload Errors (8000-8999)
  FILE_UPLOAD_FAILED = "FILE_001",
  INVALID_FILE_TYPE = "FILE_002",
  FILE_TOO_LARGE = "FILE_003",
  FILE_NOT_FOUND = "FILE_004",

  // Rate Limiting Errors (9000-9999)
  RATE_LIMIT_EXCEEDED = "RATE_001",
}

export interface ErrorResponse {
  success: false;
  errorCode: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown> | undefined;
  timestamp: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: Record<string, unknown> | undefined;
  public readonly timestamp: string;

  constructor(
    message: string,
    errorCode: ErrorCode,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);

    this.name = new.target.name;
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Fix prototype chain for TypeScript + Node
    Object.setPrototypeOf(this, new.target.prototype);

    // Correct stack trace
    Error.captureStackTrace?.(this, new.target);

    // Structured logging
    logger.error(message, {
      errorCode,
      statusCode,
      details,
      stack: this.stack,
    });
  }

  toJSON(): ErrorResponse {
    return {
      success: false,
      errorCode: this.errorCode,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

// ======================
// Subclasses
// ======================

export class AuthenticationError extends AppError {
  constructor(
    message: string = "Authentication failed",
    errorCode: ErrorCode = ErrorCode.INVALID_CREDENTIALS,
    details?: Record<string, unknown>
  ) {
    super(message, errorCode, 401, details);
  }
}

export class AuthorizationError extends AppError {
  constructor(
    message: string = "Access forbidden",
    errorCode: ErrorCode = ErrorCode.FORBIDDEN,
    details?: Record<string, unknown>
  ) {
    super(message, errorCode, 403, details);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string = "Validation failed",
    errorCode: ErrorCode = ErrorCode.VALIDATION_ERROR,
    details?: Record<string, unknown>
  ) {
    super(message, errorCode, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(
    message: string = "Resource not found",
    errorCode: ErrorCode = ErrorCode.RECORD_NOT_FOUND,
    details?: Record<string, unknown>
  ) {
    super(message, errorCode, 404, details);
  }
}

export class ConflictError extends AppError {
  constructor(
    message: string = "Resource already exists",
    errorCode: ErrorCode = ErrorCode.DUPLICATE_RECORD,
    details?: Record<string, unknown>
  ) {
    super(message, errorCode, 409, details);
  }
}

export class DatabaseError extends AppError {
  constructor(
    message: string = "Database operation failed",
    errorCode: ErrorCode = ErrorCode.DATABASE_ERROR,
    details?: Record<string, unknown>
  ) {
    super(message, errorCode, 500, details);
  }
}

export class CSVImportError extends AppError {
  constructor(
    message: string = "CSV import failed",
    errorCode: ErrorCode = ErrorCode.CSV_IMPORT_FAILED,
    details?: Record<string, unknown>
  ) {
    super(message, errorCode, 400, details);
  }
}

export class InternalServerError extends AppError {
  constructor(
    message: string = "Internal server error",
    errorCode: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
    details?: Record<string, unknown>
  ) {
    super(message, errorCode, 500, details);
  }
}
