const winston = require("winston");
const path = require("path");

const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
    }
    return value;
  };
};

const createServerLogger = (service) => {
  return winston.createLogger({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaString = Object.keys(meta).length
          ? JSON.stringify(meta, getCircularReplacer())
          : "";
        return `[${service}] ${level}: ${message} ${metaString}`;
      })
    ),
    transports: [new winston.transports.Console()],
  });
};

const createRequestLogger = (logger) => {
  return (req, res, next) => {
    const startTime = Date.now();

    logger.info(`Request received: ${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.on("finish", () => {
      const duration = Date.now() - startTime;
      logger.info(`Request completed: ${req.method} ${req.originalUrl}`, {
        status: res.statusCode,
        duration: `${duration}ms`,
      });
    });

    next();
  };
};

module.exports = {
  createServerLogger,
  createRequestLogger,
};
