import { Response } from "express";
import logger from "./logger";
import { ref } from "node:process";

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  statusCode: number;
  data?: T;
  token?: string;
  refreshToken?:string;
  errors?: Record<string, any>;
  timestamp: string;
  path?: string;
}

/**
 * Send a successful response
 */
export function sendSuccess<T>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = 200,
  token?: string,
  refreshToken?:string
): Response {
  const response: ApiResponse<T> = {
    success: true,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    path: res.req?.originalUrl || "",
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (token) {
    response.token = token;
  }
  if(refreshToken){
    response.refreshToken=refreshToken
  }

  logger.info(message, {
    statusCode,
    hasData: data !== undefined,
    path: res.req?.originalUrl,
  });

  return res.status(statusCode).json(response);
}

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  message: string,
  statusCode: number = 500,
  errorCode?: string,
  errors?: Record<string, any>
): Response {
  const response: ApiResponse = {
    success: false,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    path: res.req?.originalUrl || "",
  };

  if (errorCode) {
    response.errors = {
      code: errorCode,
      ...errors,
    };
  } else if (errors) {
    response.errors = errors;
  }

  logger.warn(message, {
    statusCode,
    errorCode,
    errors,
    path: res.req?.originalUrl,
  });

  return res.status(statusCode).json(response);
}

/**
 * Send a paginated response
 */
export function sendPaginated<T>(
  res: Response,
  message: string,
  data: T[],
  page: number,
  limit: number,
  total: number,
  statusCode: number = 200
): Response {
  const totalPages = Math.ceil(total / limit);
  const response = {
    success: true,
    message,
    statusCode,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    timestamp: new Date().toISOString(),
    path: res.req?.originalUrl || "",
  };

  logger.info(message, {
    statusCode,
    page,
    limit,
    total,
    path: res.req?.originalUrl,
  });

  return res.status(statusCode).json(response);
}

/**
 * Send a response with file download
 */
export function sendFile(
  res: Response,
  filePath: string,
  filename: string,
  contentType: string = "application/octet-stream"
): void {
  logger.info("File download initiated", {
    filename,
    path: res.req?.originalUrl,
  });

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.download(filePath);
}

/**
 * Send a response with metadata
 */
export function sendWithMeta<T>(
  res: Response,
  message: string,
  data: T,
  metadata?: Record<string, any>,
  statusCode: number = 200
): Response {
  const response = {
    success: true,
    message,
    statusCode,
    data,
    meta: metadata || {},
    timestamp: new Date().toISOString(),
    path: res.req?.originalUrl || "",
  };

  logger.info(message, {
    statusCode,
    hasMeta: !!metadata,
    path: res.req?.originalUrl,
  });

  return res.status(statusCode).json(response);
}

/**
 * Helper to create standardized error response
 */
export function formatErrorResponse(
  message: string,
  errorCode: string,
  statusCode: number = 500,
  details?: Record<string, any>
) {
  return {
    success: false,
    message,
    statusCode,
    errorCode,
    details,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper to validate request body
 */
export function validateRequestBody(
  body: any,
  requiredFields: string[]
): { valid: boolean; errors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  if(!body){
    return {valid:false,
      errors:{body:"req body not found"}
    }
  }
 

  requiredFields.forEach((field) => {
    if (!body[field] || (typeof body[field] === "string" && !body[field].trim())) {
      errors[field] = `${field} is required`;
    }
  });

  const hasErrors = Object.keys(errors).length > 0;
  if (!hasErrors) {
    return { valid: true };
  }

  return {
    valid: false,
    errors,
  };
}

/**
 * Wrap async route handlers to catch errors
 */
export function asyncHandler(
  fn: (req: any, res: any, next: any) => Promise<any>
) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
