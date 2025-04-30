// brave-llm-server.js
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const { createServerLogger } = require('./server-logger');
const env = require('./config/env');

// Initialize express app
const app = express();
const logger = createServerLogger('BraveLLM');

// Initialize OpenAI Client
if (!env.OPENAI_API_KEY) {
    logger.error('FATAL ERROR: OPENAI_API_KEY environment variable is not set.');
    process.exit(1); 
}
const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'brave-llm-service' });
});

// API chat endpoint that Visa and Culture services call
app.post('/api/chat', async (req, res) => {
  logger.info(`Received request for /api/chat`, { body: req.body });
  try {
    const { messages } = req.body; // Expecting { messages: [{ role: 'user', content: '...' }] }

    // Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0 || !messages[0].content) {
      logger.warn('Invalid request: messages array with content is required.', { body: req.body });
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request: non-empty messages array with content is required'
      });
    }

    // Extract the primary user prompt
    const userPrompt = messages[0].content;
    logger.info(`Processing LLM request with prompt starting: "${userPrompt.substring(0, 100)}..."`);

    // --- Call OpenAI API ---
    const modelToUse = "gpt-3.5-turbo"; // Or choose another model like "gpt-4"
    logger.info(`Calling OpenAI chat completions with model: ${modelToUse}`);

    const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: userPrompt }], // Pass the user prompt
        model: modelToUse,
    });

    const generatedContent = completion.choices[0]?.message?.content;

    if (!generatedContent) {
        logger.error('OpenAI response did not contain content.', { completion });
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get valid content from LLM response'
        });
    }

    logger.info(`Successfully received response from OpenAI.`);

    const response = {
        choices: [
            {
                message: {
                    content: generatedContent
                }
            }
        ]
    };
    res.json(response);

  } catch (error) {
    logger.error('Error processing LLM request via OpenAI:', {
        message: error.message,
        stack: error.stack,
        // Avoid logging potentially sensitive request body on error if needed
        // requestBody: req.body
    });
    res.status(500).json({
      status: 'error',
      message: 'Failed to process LLM request via OpenAI',
      // Optionally include non-sensitive error details
      // details: error.message
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