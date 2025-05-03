const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const dotenv = require("dotenv");
const { createServerLogger } = require("./server-logger");
const env = require("./config/env");

// Force reload environment variables
dotenv.config({ override: true });

const app = express();
const logger = createServerLogger("OpenAI");

// Middleware
app.use(cors());
app.use(express.json());

let openai;

function initializeOpenAI() {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || env.OPENAI_API_KEY,
  });
  logger.info(
    "[OpenAI] Initialized with API key:",
    (process.env.OPENAI_API_KEY || env.OPENAI_API_KEY).substring(0, 10) + "..."
  );
}

// Initialize on startup
initializeOpenAI();

// Add endpoint to refresh configuration
app.post("/refresh-config", (req, res) => {
  try {
    initializeOpenAI();
    res.json({ status: "success", message: "OpenAI configuration refreshed" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Generate itinerary endpoint
app.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        status: "error",
        message: "Prompt is required",
      });
    }

    logger.info("Generating itinerary with prompt:", prompt);

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    });

    logger.info("Successfully generated itinerary");

    res.json({
      status: "success",
      data: {
        content: completion.choices[0].message.content,
      },
    });
  } catch (error) {
    logger.error("[OpenAI] Error generating itinerary:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to generate itinerary",
      errorDetails: {
        type: error.type,
        code: error.code,
        message: error.message,
      },
    });
  }
});

// Start server
const port = process.env.AI_SERVER_PORT || env.AI_SERVER_PORT || 8001;
const server = app.listen(port, "0.0.0.0", () => {
  const address = server.address();
  console.log(
    `[OpenAI Server] Successfully listening on ${address.address}:${address.port}`
  );
  logger.info(`OpenAI server running on port ${port}`);
  console.log(`OpenAI Service listening on port ${port}`);
});

server.on("error", (error) => {
  logger.error(
    `[OpenAI Server] Failed to start listening on port ${port}:`,
    error
  );
  console.error(
    `[OpenAI Server] Failed to start listening on port ${port}:`,
    error
  );
  process.exit(1);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  logger.info("Received SIGTERM signal. Starting graceful shutdown...");
  process.exit(0);
});
