// brave-llm-server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createServerLogger } = require('./server-logger');
const env = require('./config/env');

// Initialize express app
const app = express();
const logger = createServerLogger('BraveLLM');

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'brave-llm-service' });
});

// API chat endpoint that Visa and Culture services call
app.post('/api/chat', async (req, res) => {
  logger.info(`>>> POST /api/chat HANDLER REACHED <<<`, { body: req.body });
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request: messages array is required'
      });
    }

    logger.info(`Processing LLM request with ${messages.length} messages`);
    
    // Simple mock implementation for testing
    // In a real implementation, you would make a call to an actual LLM API
    // such as OpenAI, Anthropic, etc.
    
    // Mock response to show it's working
    const response = {
      choices: [
        {
          message: {
            content: `This is a mock response from the Brave LLM service. Your query was about: ${messages[0].content.substring(0, 50)}...`
          }
        }
      ]
    };
    
    logger.info('Successfully generated LLM response');
    
    // Return the response in a format similar to OpenAI
    res.json(response);
    
  } catch (error) {
    logger.error('Error processing LLM request:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process LLM request',
      details: error.message
    });
  }
});

// Start server
const PORT = process.env.BRAVE_LLM_PORT || 8010;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Brave LLM Service started successfully on port ${PORT}`);
  console.log(`Brave LLM Service running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal. Starting graceful shutdown...');
  process.exit(0);
}); 