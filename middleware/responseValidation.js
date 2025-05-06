const { v4: uuidv4 } = require("uuid");

function createSuccessResponse(data, metadata = {}) {
  return {
    status: "success",
    timestamp: new Date().toISOString(),
    requestId: uuidv4(),
    data,
    metadata: {
      processingTime: metadata.processingTime,
      source: metadata.source,
      cached: metadata.cached || false,
    },
  };
}

function createErrorResponse(code, message, details, recoverySteps) {
  return {
    status: "error",
    timestamp: new Date().toISOString(),
    requestId: uuidv4(),
    code,
    message,
    details,
    recoverySteps,
  };
}

function validateResponse(schema) {
  return async (req, res, next) => {
    const originalJson = res.json;
    res.json = function (body) {
      try {
        const validationResult = schema.validate(body);
        if (validationResult.error) {
          console.error("Response validation failed:", validationResult.error);
          const errorResponse = createErrorResponse(
            "RESPONSE_VALIDATION_ERROR",
            "Internal response validation failed",
            validationResult.error.message
          );
          return originalJson.call(this, errorResponse);
        }
        return originalJson.call(this, body);
      } catch (error) {
        console.error("Response validation error:", error);

        let errorMessage =
          "An unexpected error occurred during response validation.";

        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === "string") {
          errorMessage = error;
        }

        const errorResponse = createErrorResponse(
          "RESPONSE_VALIDATION_ERROR",
          "Internal response validation failed",
          errorMessage
        );

        return originalJson.call(this, errorResponse);
      }
    };
    next();
  };
}
        
function errorHandler(err, req, res, next) {
  console.error("Error caught in middleware:", err);

  const errorResponse = createErrorResponse(
    err.code || "INTERNAL_SERVER_ERROR",
    err.message || "An unexpected error occurred",
    err.details,
    err.recoverySteps
  );

  if (err.code === "RATE_LIMIT_EXCEEDED") {
    errorResponse.retryAfter = err.retryAfter || 60;
  }

  res.status(err.status || 500).json(errorResponse);
}

function cacheResponse(duration) {
  const cache = new Map();

  return (req, res, next) => {
    const key = req.originalUrl || req.url;
    const now = Date.now();
    const cachedResponse = cache.get(key);

    if (cachedResponse && now - cachedResponse.timestamp < duration) {
      const response = createSuccessResponse(cachedResponse.data, {
        cached: true,
        source: "cache",
        processingTime: 0,
      });
      return res.json(response);
    }

    const originalJson = res.json;
    res.json = function (body) {
      if (body.status === "success") {
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

function debounceRequests(window = 1000) {
  const requests = new Map();

  return (req, res, next) => {
    const key = `${req.method}-${req.originalUrl}-${JSON.stringify(req.body)}`;
    const now = Date.now();
    const lastRequest = requests.get(key);

    if (lastRequest && now - lastRequest < window) {
      const errorResponse = createErrorResponse(
        "RATE_LIMIT_EXCEEDED",
        "Please wait before sending another request",
        undefined,
        ["Wait for a moment before retrying"]
      );
      return res.status(429).json(errorResponse);
    }

    requests.set(key, now);
    next();
  };
}

module.exports = {
  createSuccessResponse,
  createErrorResponse,
  validateResponse,
  errorHandler,
  cacheResponse,
  debounceRequests,
};
