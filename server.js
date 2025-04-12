const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Import configurations
const env = require('./config/env');
const { createServerLogger, createRequestLogger } = require('./server-logger');

// Import middleware
const userLimiter = require('./middleware/rateLimiter');

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
        url: `http://localhost:${env.PORT}`,
        description: 'Development server'
      }
    ]
  },
  apis: ['./routes/*.js']
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

// Apply global middleware
app.use(cors());
app.use(express.json());
app.use(createRequestLogger(logger));
app.use(userLimiter);

// Mount routes
app.use('/api/trips', tripRoutes);
app.use('/api/accommodations', accommodationRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/events', eventRoutes);
app.use('/health', healthRoutes);

// Swagger documentation route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Global error handler
app.use(errorHandler);

// Start microservices
startMCPServers().catch(error => {
  logger.error('Failed to start microservices:', error);
});

// Start the server
app.listen(env.PORT, () => {
  logger.info(`Gateway server running on port ${env.PORT}`);
  console.log(`Gateway server running on port ${env.PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal. Starting graceful shutdown...');
  process.exit(0);
});