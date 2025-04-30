"use strict";
const { createServerLogger } = require('../server-logger');
const logger = createServerLogger('ErrorHandler');
function errorHandler(err, req, res, next) {
    var _a, _b;
    logger.error('Unhandled error:', err);
    // Default error response
    const errorResponse = {
        status: 'error',
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected error occurred',
        timestamp: new Date().toISOString()
    };
    // Add service error details if available
    if ((_a = err.response) === null || _a === void 0 ? void 0 : _a.data) {
        errorResponse.serviceError = err.response.data;
    }
    // Determine status code
    const statusCode = err.statusCode || ((_b = err.response) === null || _b === void 0 ? void 0 : _b.status) || 500;
    // Send error response
    res.status(statusCode).json(errorResponse);
}
module.exports = errorHandler;
