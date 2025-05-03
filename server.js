const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const { createServerLogger, createRequestLogger } = require("./server-logger");

// Load environment variables
dotenv.config();

const env = {
  PORT: process.env.PORT || 8000, // Changed from 5000 to 8000
  NODE_ENV: process.env.NODE_ENV || "development",
  HOST: process.env.HOST || "127.0.0.1",
  WAIT_FOR_SERVERS: process.env.WAIT_FOR_SERVERS === "true",
  VISA_REQUEST_TIMEOUT: parseInt(process.env.VISA_REQUEST_TIMEOUT) || 25000,
  CULTURE_REQUEST_TIMEOUT:
    parseInt(process.env.CULTURE_REQUEST_TIMEOUT) || 30000,
};

// Create logs directory
const logDir = path.join(__dirname, "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Initialize logger and Express app
const logger = createServerLogger("Server");
const app = express();

// CORS configuration
app.use(
  cors({
    origin: ["http://localhost:19006", "http://10.0.2.2:19006"],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// Middleware
app.use(express.json());
app.use(createRequestLogger(logger));

// Request timeout middleware
app.use((req, res, next) => {
  const timeout = req.path.includes("visa")
    ? env.VISA_REQUEST_TIMEOUT
    : env.CULTURE_REQUEST_TIMEOUT;

  req.setTimeout(timeout);
  next();
});

// Routes
const tripRoutes = require("./services/tripService");
app.use("/api/trips", tripRoutes);

// Error handler
app.use((err, req, res, next) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
});

// Start server
const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`Server starting...`);
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Host: ${env.HOST}`);
  console.log(`Port: ${env.PORT}`);

  logger.info(`Gateway server running`, {
    host: env.HOST,
    port: env.PORT,
    mode: env.NODE_ENV,
    waitForServers: env.WAIT_FOR_SERVERS,
  });
});

// Error handling
server.on("error", (error) => {
  console.error("Server failed to start:", error);
  logger.error("Server failed to start:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  logger.error("Unhandled Rejection:", { reason, promise });
});

module.exports = server;
