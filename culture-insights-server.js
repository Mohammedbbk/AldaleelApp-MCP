// culture-insights-server.js

require('dotenv').config(); // Load .env file variables
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createServerLogger } = require('./server-logger'); // Adjust path if needed

// --- Configuration ---
const PORT = process.env.CULTURE_INSIGHTS_PORT || 8008; // Use a new default port
// Point to the same LLM service as the visa server
const LLM_SERVICE_URL = process.env.BRAVE_MCP_URL || `http://localhost:${process.env.BRAVE_PORT || 8005}`;
const LLM_API_ENDPOINT = process.env.BRAVE_API_ENDPOINT || '/api/chat';
const REQUEST_TIMEOUT = parseInt(process.env.CULTURE_REQUEST_TIMEOUT) || 30000; // 30 seconds timeout

// --- Initialization ---
const app = express();
const logger = createServerLogger('culture-insights'); // Use specific logger name

// --- Middleware ---
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse incoming JSON requests

// --- Helper: Call LLM Service ---
async function getCultureInsightsFromLLM(nationality, destination) {
  const targetUrl = `${LLM_SERVICE_URL}${LLM_API_ENDPOINT}`;
  logger.info(`Querying LLM at ${targetUrl} for culture insights: ${nationality} -> ${destination}`);

  try {
    const response = await axios.post(
      targetUrl,
      {
        // Ensure this payload matches what the LLM endpoint expects
        messages: [
          {
            role: 'user',
            content: `Provide cultural insights for a ${nationality} citizen traveling to ${destination}. Focus on:
1.  **Greetings & Etiquette:** Common greetings, addressing people (formal/informal), gestures to use/avoid.
2.  **Social Norms:** Tipping customs, gift-giving practices, punctuality expectations, public behavior.
3.  **Communication:** Direct vs. indirect communication styles, sensitive topics to avoid.
4.  **Food & Dining:** Meal etiquette, common local dishes, dietary considerations (if any specific to the destination).
5.  **Key Phrases:** A few essential phrases in the local language (e.g., hello, thank you, excuse me).
6.  **Important Note:** Any critical cultural aspect a visitor should be aware of to avoid misunderstandings or offense.`
          }
        ],
        // Add other parameters like 'stream: false' if needed by the endpoint
        // stream: false
      },
      { timeout: REQUEST_TIMEOUT } // Use configurable timeout
    );

    // Adapt this based on the ACTUAL response structure of your LLM endpoint
    const content = response.data?.choices?.[0]?.message?.content // OpenAI-like structure
                 || response.data?.message?.content          // Simple message structure
                 || response.data?.content                     // Direct content
                 || JSON.stringify(response.data);          // Fallback: Stringify the whole data

    if (!content || content === '{}' || content === '""') {
        logger.warn(`LLM returned empty or invalid content for culture insights: ${nationality} -> ${destination}`);
        return "Cultural information service did not provide specific details.";
    }
    logger.info(`Successfully received culture insights from LLM for ${nationality} -> ${destination}`);
    return content.trim();

  } catch (error) {
    const status = error.response?.status;
    const errorData = error.response?.data;
    logger.error(`Error calling LLM (${targetUrl}): ${error.message}`, { status, errorData });
    throw new Error(`LLM service request failed with status ${status || 'unknown'}`); // Re-throw cleaner error
  }
}

// --- API Routes ---

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'culture-insights-service' });
});

// Get Culture Insights
app.post('/culture-insights', async (req, res) => {
  const { nationality, destination } = req.body;

  // Validation
  if (!nationality || !destination || typeof nationality !== 'string' || typeof destination !== 'string') {
    logger.warn('Invalid request to /culture-insights: Missing or invalid params', { body: req.body });
    return res.status(400).json({
      status: 'error',
      message: 'Parameters "nationality" and "destination" (strings) are required.',
    });
  }

  try {
    const cultureContent = await getCultureInsightsFromLLM(nationality, destination);

    res.json({
      status: 'success',
      cultureInsights: {
        content: cultureContent,
        source: "LLM Information Service" // Generic source name
      }
    });
  } catch (error) {
    // Error already logged in helper function
    res.status(502).json({ // 502 Bad Gateway suggests upstream failure
      status: 'error',
      message: 'Failed to retrieve cultural insights from the information service.',
      details: error.message // Pass cleaner error message
    });
  }
});

// --- Server Start ---
app.listen(PORT, () => {
  logger.info(`Culture Insights Server started successfully on port ${PORT}`);
  logger.info(`Configured to query LLM at: ${LLM_SERVICE_URL}${LLM_API_ENDPOINT}`);
});