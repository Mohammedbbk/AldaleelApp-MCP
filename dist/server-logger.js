"use strict";
const winston = require('winston');
const path = require('path');
/**
 * Creates a configured logger for MCP servers
 * @param {string} serverName - Name of the server (e.g., 'OpenAI', 'Mapbox', 'LiveEvents')
 * @returns {winston.Logger} Configured logger instance
 */
const createServerLogger = (serverName) => {
    // Create logs directory if it doesn't exist
    const logDir = path.join(__dirname, 'logs');
    // Create a logger with the server name
    const logger = winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(winston.format.timestamp(), winston.format.printf(({ level, message, timestamp }) => {
            return `${timestamp} [${serverName}] ${level}: ${message}`;
        })),
        transports: [
            // Write all logs to server-specific files
            new winston.transports.File({
                filename: path.join(logDir, `${serverName.toLowerCase()}-error.log`),
                level: 'error'
            }),
            new winston.transports.File({
                filename: path.join(logDir, `${serverName.toLowerCase()}.log`)
            }),
            // Also write to a combined log file
            new winston.transports.File({
                filename: path.join(logDir, 'all-servers.log')
            })
        ]
    });
    // Add console transport in all environments
    logger.add(new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.printf(({ level, message, timestamp }) => {
            return `${timestamp} [${serverName}] ${level}: ${message}`;
        }))
    }));
    return logger;
};
/**
 * Creates a request logger middleware for Express
 * @param {winston.Logger} logger - Winston logger instance
 * @returns {Function} Express middleware function
 */
const createRequestLogger = (logger) => {
    return (req, res, next) => {
        const startTime = Date.now();
        // Log when the request is received
        logger.info(`Request received: ${req.method} ${req.originalUrl}`);
        // Override end method to log when response is sent
        const originalEnd = res.end;
        res.end = function (chunk, encoding) {
            const responseTime = Date.now() - startTime;
            logger.info(`Response sent: ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${responseTime}ms`);
            return originalEnd.call(this, chunk, encoding);
        };
        next();
    };
};
module.exports = {
    createServerLogger,
    createRequestLogger
};
