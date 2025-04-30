"use strict";
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
// Import configurations
const env = require('./config/env');
const { createServerLogger, createRequestLogger } = require('./server-logger');
// Import middleware
const userLimiter = require('./middleware/rateLimiter'); // Assuming rateLimit setup is inside this file
// Import routes
const tripRoutes = require('./routes/tripRoutes');
const healthRoutes = require('./routes/healthRoutes');
const accommodationRoutes = require('./routes/accommodationRoutes');
const proxyRoutes = require('./routes/proxyRoutes');
const eventRoutes = require('./routes/eventRoutes');
// Import error handler
const errorHandler = require('./middleware/errorHandler');
// Swagger documentation setup
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Aldaleel MCP API',
            version: '1.0.0',
            description: 'API documentation for Aldaleel MCP service'
        },
        servers: [
            {
                // You might want to update this dynamically based on NODE_ENV for better docs
                url: env.NODE_ENV === 'production' ? 'https://aldaleelapp-mcp.onrender.com' : `http://localhost:${env.PORT}`,
                description: env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
            }
        ]
    },
    apis: ['./routes/*.js'] // Make sure this points to files with swagger annotations
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
// Import services
const { startMCPServers } = require('./services/microserviceManager');
// Create logger instance
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}
const logger = createServerLogger('Gateway');
// Initialize Express app
const app = express();
// Trust proxy for correct IP/protocol detection (important for rate limiting, etc.)
app.set('trust proxy', 1);
// --- IMPORTANT FIX ---
// Trust the first proxy hop (like Render's load balancer)
// This is crucial for express-rate-limit to work correctly behind a proxy
app.set('trust proxy', 1);
// -------------------
// Apply global middleware
app.use(cors()); // Enable CORS - consider more specific origins for production
app.use(express.json()); // Parse JSON bodies
app.use(createRequestLogger(logger)); // Log requests
// Conditionally apply rate limiter, skipping the /health endpoint
app.use((req, res, next) => {
    if (req.path === '/health') {
        return next();
    }
    return userLimiter(req, res, next);
});
// Mount routes
app.use('/api/trips', tripRoutes);
app.use('/api/accommodations', accommodationRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/events', eventRoutes);
app.use('/health', healthRoutes); // Health check endpoint
// Swagger documentation route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// Global error handler - should be last middleware
app.use(errorHandler);
// Start microservices only if not in a test environment perhaps
if (process.env.NODE_ENV !== 'test') {
    startMCPServers().catch(error => {
        logger.error('Failed to start microservices:', error);
        // Consider exiting if microservices are critical and fail to start
        // process.exit(1);
    });
}
// Start the server
// Explicitly listen on 0.0.0.0 to ensure accessibility within Docker
const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Gateway server running on host 0.0.0.0, port ${env.PORT} in ${env.NODE_ENV} mode`);
    console.log(`Gateway server running on host 0.0.0.0, port ${env.PORT} in ${env.NODE_ENV} mode`);
});
// Handle graceful shutdown
process.on('SIGTERM', () => {
    logger.info('Received SIGTERM signal. Starting graceful shutdown...');
    // Add any cleanup logic here (e.g., close DB connections, stop microservices)
    server.close(() => {
        logger.info('HTTP server closed.');
        // Exit process after server closes
        process.exit(0);
    });
    // Force exit after a timeout if graceful shutdown takes too long
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000); // 10 seconds timeout
});
process.on('SIGINT', () => {
    logger.info('Received SIGINT signal. Shutting down...');
    // Trigger SIGTERM handler for consistent shutdown logic
    process.kill(process.pid, 'SIGTERM');
});
