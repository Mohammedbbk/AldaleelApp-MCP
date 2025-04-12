const { createServerLogger } = require('../server-logger');

const logger = createServerLogger('ErrorHandler');

function errorHandler(err, req, res, next) {
  logger.error('Unhandled error:', err);

  // Default error response
  const errorResponse = {
    status: 'error',
    code: err.code || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  };

  // Add service error details if available
  if (err.response?.data) {
    errorResponse.serviceError = err.response.data;
  }

  // Determine status code
  const statusCode = err.statusCode || err.response?.status || 500;

  // Send error response
  res.status(statusCode).json(errorResponse);
}

module.exports = errorHandler;