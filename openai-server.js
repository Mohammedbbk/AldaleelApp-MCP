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
      model: 'gpt-4-turbo-preview',
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
    logger.error('Error generating itinerary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate itinerary',
      error: error.message
    });
  }
});

// Start server
const port = process.env.AI_SERVER_PORT || env.AI_SERVER_PORT || 8001;
app.listen(port, '0.0.0.0', () => {
  logger.info(`OpenAI server running on port ${port}`);
  console.log(`OpenAI Service listening on port ${port}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal. Starting graceful shutdown...');
  process.exit(0);
});