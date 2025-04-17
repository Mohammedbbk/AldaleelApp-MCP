// visa-requirements-server.js

require('dotenv').config(); // Load .env file variables
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createServerLogger } = require('./server-logger'); // Adjust path if needed
const { createRequestLogger } = require('./request-logger'); // Adjust path if needed

// --- Configuration ---
const PORT = process.env.VISA_REQUIREMENTS_PORT || 8009;
// IMPORTANT: Default URL corrected - Ensure BRAVE_MCP_URL points to the ACTUAL Brave/LLM service URL/Port
// Do NOT default to the gateway port (8000) unless the gateway specifically handles /api/chat for Brave.
const BRAVE_MCP_URL = process.env.BRAVE_MCP_URL || `http://localhost:${process.env.BRAVE_PORT || 3002}`; // Example: Using BRAVE_PORT, defaulting to 8005
const BRAVE_API_ENDPOINT = process.env.BRAVE_API_ENDPOINT || '/api/chat'; // Make endpoint configurable if needed
const REQUEST_TIMEOUT = parseInt(process.env.VISA_REQUEST_TIMEOUT) || 25000; // 25 seconds timeout

// --- Initialization ---
const app = express();

const logger = createServerLogger('VisaRequirements');

// --- Middleware ---
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse incoming JSON requests
app.use(createRequestLogger(logger)); // Log incoming requests

// --- Helper: Call Brave/LLM Service ---
async function getVisaInfoFromLLM(nationality, destination) {
  const targetUrl = `${BRAVE_MCP_URL}${BRAVE_API_ENDPOINT}`;
  logger.info(`Querying LLM at ${targetUrl} for visa: ${nationality} -> ${destination}`);

  try {
    const response = await axios.post(
      targetUrl,
      {
        // Ensure this payload matches what the Brave/LLM endpoint expects
        messages: [
          {
            role: 'user',
            content: `What are the visa requirements for a ${nationality} citizen traveling to ${destination}? Please provide detailed information about visa types, required documents, application process, fees, validity, length of stay, and any specific warnings or important notes.`
          }
        ],
        // Add other parameters like 'stream: false' if needed by the endpoint
        // stream: false
      },
      { timeout: REQUEST_TIMEOUT } // Use configurable timeout
    );

    // **Adapt this based on the ACTUAL response structure of your Brave/LLM endpoint**
    // Trying common structures:
    const content = response.data?.choices?.[0]?.message?.content // OpenAI-like structure
                 || response.data?.message?.content          // Simple message structure
                 || response.data?.content                     // Direct content
                 || JSON.stringify(response.data);          // Fallback: Stringify the whole data

    if (!content || content === '{}' || content === '""') {
        logger.warn(`LLM returned empty or invalid content for ${nationality} -> ${destination}`);
        return "Visa information service did not provide specific details.";
    }
    logger.info(`Successfully received visa info from LLM for ${nationality} -> ${destination}`);
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
  res.status(200).json({ status: 'ok', service: 'visa-requirements-service' });
});

// Get Visa Requirements
app.post('/visa-requirements', async (req, res, next) => {
  logger.info('>>> POST /visa-requirements HANDLER REACHED <<<', { body: req.body });
  const { nationality, destination } = req.body;

  // Validation
  if (!nationality || !destination || typeof nationality !== 'string' || typeof destination !== 'string') {
    logger.warn('Invalid request to /visa-requirements: Missing or invalid params', { body: req.body });
    return res.status(400).json({
      status: 'error',
      message: 'Parameters "nationality" and "destination" (strings) are required.',
    });
  }

  try {
    logger.info(`[POST /visa-requirements] Calling getVisaInfoFromLLM for ${nationality} -> ${destination}`);
    const visaContent = await getVisaInfoFromLLM(nationality, destination);
    logger.info(`[POST /visa-requirements] Received content from LLM. Length: ${visaContent?.length || 0}`);

    // --- Parse the LLM response into structured fields ---
    function parseVisaRequirements(rawContent) {
      // Simple regex-based parser for demonstration
      const type = /Type:\s*(.+)/i.exec(rawContent)?.[1] || '';
      const processingTime = /Processing Time:\s*(.+)/i.exec(rawContent)?.[1] || '';
      const requiredDocumentsMatch = /Required Documents:\s*([\s\S]*?)(?:\n[A-Z][a-z]+:|$)/i.exec(rawContent);
      const requiredDocuments = requiredDocumentsMatch
        ? requiredDocumentsMatch[1].split('\n').map(line => line.replace(/^- /, '').trim()).filter(Boolean)
        : [];
      const notes = /Notes:\s*([\s\S]*)/i.exec(rawContent)?.[1] || '';
      // If at least one field is filled, treat as structured
      if (type || processingTime || requiredDocuments.length > 0 || notes) {
        return { type, processingTime, requiredDocuments, notes };
      }
      // Otherwise, fallback to raw content
      return { content: rawContent };
    }

    const structured = parseVisaRequirements(visaContent);
    logger.info('[POST /visa-requirements] Sending success response.');
    res.json({
      status: 'success',
      visaRequirements: structured
    });
  } catch (error) {
    logger.error(`[POST /visa-requirements] Error caught in route handler: ${error.message}`);
    // Error already logged in helper function
    res.status(502).json({ // 502 Bad Gateway suggests upstream failure
      status: 'error',
      message: 'Failed to retrieve visa requirements from the information service.',
      details: error.message // Pass cleaner error message
    });
  }
});

// --- Server Start ---
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Visa Requirements Server started successfully on port ${PORT}`);
  logger.info(`Configured to query LLM at: ${BRAVE_MCP_URL}${BRAVE_API_ENDPOINT}`);
  // Add a warning if the default URL looks like the gateway itself
  if (BRAVE_MCP_URL.includes(':8000')) {
      logger.warn('Potential Misconfiguration: BRAVE_MCP_URL seems to point to the gateway (port 8000). Ensure it points to the correct LLM/Brave service.');
  }
});