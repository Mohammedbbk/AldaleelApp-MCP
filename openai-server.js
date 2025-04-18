const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { createServerLogger } = require('./server-logger');
const env = require('./config/env');

const app = express();
const logger = createServerLogger('OpenAI');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || env.OPENAI_API_KEY
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Generate itinerary endpoint
app.post('/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        status: 'error',
        message: 'Prompt is required'
      });
    }

    logger.info('Generating itinerary with prompt:', prompt);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    logger.info('Successfully generated itinerary');

    res.json({
      status: 'success',
      data: {
        content: completion.choices[0].message.content
      }
    });
  } catch (error) {
    // Log basic error information
    logger.error('[OpenAI] Error generating itinerary:', error.message);

    // Log the full error object for deep inspection
    console.error('[OpenAI Detailed Error] Full Object:', JSON.stringify(error, null, 2));

    // Log specific nested properties when available
    if (error.response) {
      console.error('[OpenAI Detailed Error] Status:', error.response.status);
      console.error('[OpenAI Detailed Error] Headers:', error.response.headers);
      console.error('[OpenAI Detailed Error] Data:', error.response.data);
    } else {
      console.error('[OpenAI Detailed Error] Code:', error.code);
      console.error('[OpenAI Detailed Error] Type:', error.type);
      console.error('[OpenAI Detailed Error] Param:', error.param);
    }

    // Respond with a generic message while optionally exposing safe error metadata
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate itinerary',
      errorDetails: {
        type: error.type,
        code: error.code,
        message: error.message
      }
    });
  }
});

// Start server
const port = process.env.AI_SERVER_PORT || env.AI_SERVER_PORT || 8001;
const server = app.listen(port, '0.0.0.0', () => {
  const address = server.address();
  console.log(`[OpenAI Server] Successfully listening on ${address.address}:${address.port}`);
  logger.info(`OpenAI server running on port ${port}`);
  console.log(`OpenAI Service listening on port ${port}`);
});

server.on('error', (error) => {
  logger.error(`[OpenAI Server] Failed to start listening on port ${port}:`, error);
  console.error(`[OpenAI Server] Failed to start listening on port ${port}:`, error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal. Starting graceful shutdown...');
  process.exit(0);
});