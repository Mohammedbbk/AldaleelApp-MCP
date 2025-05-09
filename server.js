const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const { createServerLogger, createRequestLogger } = require("./server-logger");
const fetch = require("node-fetch");

dotenv.config();

const env = {
  PORT: process.env.PORT || 8000, 
  NODE_ENV: process.env.NODE_ENV || "development",
  HOST: process.env.HOST || "127.0.0.1",
  WAIT_FOR_SERVERS: process.env.WAIT_FOR_SERVERS === "true",
  VISA_REQUEST_TIMEOUT: parseInt(process.env.VISA_REQUEST_TIMEOUT) || 25000,
  CULTURE_REQUEST_TIMEOUT:
    parseInt(process.env.CULTURE_REQUEST_TIMEOUT) || 30000,
};

const logDir = path.join(__dirname, "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = createServerLogger("Server");
const app = express();

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization"],
    credentials: true,
    maxAge: 86400, 
  })
);

app.options("*", cors());

app.use(express.json());
app.use(createRequestLogger(logger));

app.use((req, res, next) => {
  const timeout = req.path.includes("visa")
    ? env.VISA_REQUEST_TIMEOUT
    : env.CULTURE_REQUEST_TIMEOUT;

  req.setTimeout(timeout);
  next();
});

const tripRoutes = require("./services/tripService");
app.use("/api/trips", tripRoutes);

app.post("/api/chat", async (req, res) => {
  try {
    logger.info("Received chat request, proxying to brave-llm-server");
    
    const braveUrl = process.env.BRAVE_LLM_URL || "http://localhost:8010";
    const response = await fetch(`${braveUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });
    
    if (!response.ok) {
      throw new Error(`Brave LLM server responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    logger.info("Successfully proxied chat response from brave-llm-server");
    res.json(data);
  } catch (error) {
    logger.error("Error proxying chat request:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to process chat request",
    });
  }
});

app.use((err, req, res, next) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
});

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
