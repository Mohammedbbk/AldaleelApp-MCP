"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSuccessResponse = createSuccessResponse;
exports.createErrorResponse = createErrorResponse;
exports.validateResponse = validateResponse;
exports.errorHandler = errorHandler;
exports.cacheResponse = cacheResponse;
exports.debounceRequests = debounceRequests;
const uuid_1 = require("uuid");
// Utility to create standardized success response
function createSuccessResponse(data, metadata) {
    return {
        status: 'success',
        timestamp: new Date().toISOString(),
        requestId: (0, uuid_1.v4)(),
        data,
        metadata: {
            processingTime: metadata === null || metadata === void 0 ? void 0 : metadata.processingTime,
            source: metadata === null || metadata === void 0 ? void 0 : metadata.source,
            cached: (metadata === null || metadata === void 0 ? void 0 : metadata.cached) || false,
        },
    };
}
// Utility to create standardized error response
function createErrorResponse(code, message, details, recoverySteps) {
    return {
        status: 'error',
        timestamp: new Date().toISOString(),
        requestId: (0, uuid_1.v4)(),
        code,
        message,
        details,
        recoverySteps,
    };
}
// Response validation middleware
function validateResponse(schema) {
    return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        const originalJson = res.json;
        res.json = function (body) {
            try {
                // Validate response against schema
                const validationResult = schema.validate(body);
                if (validationResult.error) {
                    console.error('Response validation failed:', validationResult.error);
                    // No change needed here, validationResult.error is usually well-typed by Joi
                    const errorResponse = createErrorResponse('RESPONSE_VALIDATION_ERROR', 'Internal response validation failed', validationResult.error.message);
                    return originalJson.call(this, errorResponse);
                }
                return originalJson.call(this, body);
            }
            catch (error) { // 'error' is potentially unknown
                console.error('Response validation error:', error);
                // --- FIX START ---
                let errorMessage = 'An unexpected error occurred during response validation.'; // Default message
                if (error instanceof Error) {
                    // If it's a standard Error object, use its message
                    errorMessage = error.message;
                }
                else if (typeof error === 'string') {
                    // If a plain string was thrown
                    errorMessage = error;
                }
                // You could add more checks here (e.g., for objects with a message property) if needed
                const errorResponse = createErrorResponse('RESPONSE_VALIDATION_ERROR', 'Internal response validation failed', errorMessage // Use the safely extracted message
                );
                // --- FIX END ---
                // originalJson needs to be called within the function scope where it was defined
                // It seems 'this' might be incorrect here depending on how res.json is called.
                // Assuming 'this' refers to the response object as intended by originalJson.call(this, ...)
                return originalJson.call(this, errorResponse);
            }
        };
        next();
    });
}
// Error handling middleware
function errorHandler(err, req, res, next) {
    console.error('Error caught in middleware:', err);
    const errorResponse = createErrorResponse(err.code || 'INTERNAL_SERVER_ERROR', err.message || 'An unexpected error occurred', err.details, err.recoverySteps);
    // Add retry information for specific error types
    if (err.code === 'RATE_LIMIT_EXCEEDED') {
        errorResponse.retryAfter = err.retryAfter || 60;
    }
    res.status(err.status || 500).json(errorResponse);
}
// Response caching middleware
function cacheResponse(duration) {
    const cache = new Map();
    return (req, res, next) => {
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
        res.json = function (body) {
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
function debounceRequests(window = 1000) {
    const requests = new Map();
    return (req, res, next) => {
        const key = `${req.method}-${req.originalUrl}-${JSON.stringify(req.body)}`;
        const now = Date.now();
        const lastRequest = requests.get(key);
        if (lastRequest && now - lastRequest < window) {
            const errorResponse = createErrorResponse('RATE_LIMIT_EXCEEDED', 'Please wait before sending another request', undefined, ['Wait for a moment before retrying']);
            return res.status(429).json(errorResponse);
        }
        requests.set(key, now);
        next();
    };
}
