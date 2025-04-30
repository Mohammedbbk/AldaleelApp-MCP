import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { BaseResponse, ErrorResponse, SuccessResponse } from '../types/responses';

// Utility to create standardized success response
export function createSuccessResponse<T>(data: T, metadata?: any): SuccessResponse<T> {
  return {
    status: 'success',
    timestamp: new Date().toISOString(),
    requestId: uuidv4(),
    data,
    metadata: {
      processingTime: metadata?.processingTime,
      source: metadata?.source,
      cached: metadata?.cached || false,
    },
  };
}

// Utility to create standardized error response
export function createErrorResponse(
  code: string,
  message: string,
  details?: string,
  recoverySteps?: string[]
): ErrorResponse {
  return {
    status: 'error',
    timestamp: new Date().toISOString(),
    requestId: uuidv4(),
    code,
    message,
    details,
    recoverySteps,
  };
}

// Response validation middleware
export function validateResponse(schema: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    res.json = function (body: any) {
      try {
        // Validate response against schema
        const validationResult = schema.validate(body);
        if (validationResult.error) {
          console.error('Response validation failed:', validationResult.error);
          const errorResponse = createErrorResponse(
            'RESPONSE_VALIDATION_ERROR',
            'Internal response validation failed',
            validationResult.error.message
          );
          return originalJson.call(this, errorResponse);
        }
        return originalJson.call(this, body);
      } catch (error) {
        console.error('Response validation error:', error);
        const errorResponse = createErrorResponse(
          'RESPONSE_VALIDATION_ERROR',
          'Internal response validation failed',
          error.message
        );
        return originalJson.call(this, errorResponse);
      }
    };
    next();
  };
}

// Error handling middleware
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('Error caught in middleware:', err);

  const errorResponse = createErrorResponse(
    err.code || 'INTERNAL_SERVER_ERROR',
    err.message || 'An unexpected error occurred',
    err.details,
    err.recoverySteps
  );

  // Add retry information for specific error types
  if (err.code === 'RATE_LIMIT_EXCEEDED') {
    errorResponse.retryAfter = err.retryAfter || 60;
  }

  res.status(err.status || 500).json(errorResponse);
}

// Response caching middleware
export function cacheResponse(duration: number) {
  const cache = new Map<string, { data: any; timestamp: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.originalUrl || req.url;
    const now = Date.now();
    const cachedResponse = cache.get(key);

    if (cachedResponse && now - cachedResponse.timestamp < duration) {
      const response = createSuccessResponse(cachedResponse.data, {
        cached: true,
        source: 'cache',
        processingTime: 0,
      });
      return res.json(response);
    }

    const originalJson = res.json;
    res.json = function (body: any) {
      if (body.status === 'success') {
        cache.set(key, {
          data: body.data,
          timestamp: now,
        });
      }
      return originalJson.call(this, body);
    };

    next();
  };
}

// Request debouncing middleware
export function debounceRequests(window: number = 1000) {
  const requests = new Map<string, number>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.method}-${req.originalUrl}-${JSON.stringify(req.body)}`;
    const now = Date.now();
    const lastRequest = requests.get(key);

    if (lastRequest && now - lastRequest < window) {
      const errorResponse = createErrorResponse(
        'RATE_LIMIT_EXCEEDED',
        'Please wait before sending another request',
        undefined,
        ['Wait for a moment before retrying']
      );
      return res.status(429).json(errorResponse);
    }

    requests.set(key, now);
    next();
  };
} 