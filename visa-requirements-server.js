require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createServerLogger } = require('./server-logger'); 

const PORT = process.env.VISA_REQUIREMENTS_PORT || 8009;
const BRAVE_MCP_URL = process.env.BRAVE_MCP_URL || `http://localhost:${process.env.BRAVE_PORT || 8010}`; // This points to brave-llm-server.js
const BRAVE_API_ENDPOINT = process.env.BRAVE_API_ENDPOINT || '/api/chat'; 
const REQUEST_TIMEOUT = parseInt(process.env.VISA_REQUEST_TIMEOUT) || 25000; 

const app = express();

const logger = createServerLogger('VisaRequirements');

app.use(cors()); 
app.use(express.json()); 

async function getVisaInfoFromLLM(nationality, destination) {
  // --- Step 1: Retrieve up-to-date information (Simulated RAG - Retrieval part) ---
  // In a real RAG setup, you would call a search API (e.g., Brave Search API if available, or another search provider)
  // to get the latest visa information snippets or relevant page content.
  let retrievedContextFromSearch = "";
  const searchQuery = `latest visa requirements for ${nationality} citizen traveling to ${destination === 'SA' ? 'Saudi Arabia' : destination}`;
  logger.info(`[RAG] Simulating search query: "${searchQuery}"`);
  try {
    // Placeholder: Simulate a call to a hypothetical Brave Search service or other information retrieval system.
    // const searchServiceUrl = process.env.ACTUAL_BRAVE_SEARCH_API_URL; // Example: http://localhost:XXXX/search
    // if (searchServiceUrl) {
    //   const searchResponse = await axios.get(searchServiceUrl, { params: { query: searchQuery }, timeout: 10000 });
    //   retrievedContextFromSearch = searchResponse.data.summary || searchResponse.data.snippets.join('\n'); // Adapt based on actual API
    //   logger.info(`[RAG] Successfully retrieved context from search. Length: ${retrievedContextFromSearch.length}`);
    // } else {
    //   logger.warn('[RAG] ACTUAL_BRAVE_SEARCH_API_URL not configured. Using placeholder context.');
    //   retrievedContextFromSearch = `Placeholder: No live search configured. Current general knowledge about visa for ${nationality} to ${destination} should be used.`;
    // }
    // For this example, we'll use a placeholder indicating search wasn't performed live.
    retrievedContextFromSearch = `Key considerations for ${nationality} traveling to ${destination === 'SA' ? 'Saudi Arabia' : destination} often include specific document validity periods and proof of funds. Always verify with the official embassy or consulate website for the most current details.`;
    logger.info(`[RAG] Using simulated/placeholder context: "${retrievedContextFromSearch.substring(0,100)}..."`);

  } catch (searchError) {
    logger.error(`[RAG] Error during simulated search/retrieval step: ${searchError.message}. Proceeding without augmented context.`);
    retrievedContextFromSearch = "Error retrieving up-to-date information. Please use general knowledge.";
  }
  // --- End of Simulated RAG - Retrieval part ---

  const targetUrl = `${BRAVE_MCP_URL}${BRAVE_API_ENDPOINT}`; // This is brave-llm-server.js
  logger.info(`Querying LLM at ${targetUrl} for visa: ${nationality} -> ${destination === 'SA' ? 'Saudi Arabia' : destination} (with RAG context)`);

  const userQueryForLLM = `What are the visa requirements for a ${nationality} citizen traveling to ${destination === 'SA' ? 'Saudi Arabia' : destination}? Please provide detailed information about visa types, required documents, application process, fees, validity, length of stay, and any specific warnings or important notes. Use any provided context to ensure the information is as up-to-date as possible.`;

  const payload = {
    messages: [
      {
        role: 'user',
        content: userQueryForLLM
      }
    ],
    // This context field is used by brave-llm-server.js to augment its system prompt.
    context: retrievedContextFromSearch 
  };

  try {
    logger.info(`[getVisaInfoFromLLM] >>> Preparing to POST to ${targetUrl}`, { payload: JSON.stringify(payload) }); 
    const response = await axios.post(
      targetUrl,
      payload,
      { timeout: REQUEST_TIMEOUT }
    );
    logger.info(`[getVisaInfoFromLLM] <<< Successfully received response from ${targetUrl}`, { status: response.status }); 

    const content = response.data?.choices?.[0]?.message?.content 
                 || response.data?.message?.content          
                 || response.data?.content                     
                 || JSON.stringify(response.data);         

    if (!content || content === '{}' || content === '""') {
        logger.warn(`LLM returned empty or invalid content for ${nationality} -> ${destination}`);
        return "Visa information service did not provide specific details.";
    }
    logger.info(`Successfully received visa info from LLM for ${nationality} -> ${destination}`);
    return content.trim();

  } catch (error) {
    const status = error.response?.status;
    const errorData = error.response?.data;
    const errorCode = error.code; 
    logger.error(`[getVisaInfoFromLLM] !!! Error calling LLM (${targetUrl}): ${error.message}`, { status, errorCode, errorData: JSON.stringify(errorData) }); 
    if (errorCode === 'ECONNREFUSED') {
       throw new Error(`LLM service connection refused at ${targetUrl}`);
    } else if (errorCode === 'ETIMEDOUT') {
       throw new Error(`LLM service request timed out at ${targetUrl}`);
    } else {
       throw new Error(`LLM service request failed with status ${status || 'unknown'} (Code: ${errorCode || 'N/A'})`);
    }
  }
}


app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'visa-requirements-service' });
});

app.post('/visa-requirements', async (req, res, next) => {
  logger.info('>>> POST /visa-requirements HANDLER REACHED <<<', { body: req.body });
  const { nationality, destination } = req.body;

  if (!nationality || !destination || typeof nationality !== 'string' || typeof destination !== 'string') {
    logger.warn('Invalid request to /visa-requirements: Missing or invalid params', { body: req.body });
    return res.status(400).json({
      status: 'error',
      message: 'Parameters "nationality" and "destination" (strings) are required.',
    });
  }

  try {
    logger.info(`[POST /visa-requirements] ---> Calling getVisaInfoFromLLM for ${nationality} -> ${destination}`);
    const visaContent = await getVisaInfoFromLLM(nationality, destination);
    logger.info(`[POST /visa-requirements] <--- Received content from LLM. Length: ${visaContent?.length || 0}`);

    function parseVisaRequirements(rawContent) {
      const type = /Type:\s*(.+)/i.exec(rawContent)?.[1] || '';
      const processingTime = /Processing Time:\s*(.+)/i.exec(rawContent)?.[1] || '';
      const requiredDocumentsMatch = /Required Documents:\s*([\s\S]*?)(?:\n[A-Z][a-z]+:|$)/i.exec(rawContent);
      const requiredDocuments = requiredDocumentsMatch
        ? requiredDocumentsMatch[1].split('\n').map(line => line.replace(/^- /, '').trim()).filter(Boolean)
        : [];
      const notes = /Notes:\s*([\s\S]*)/i.exec(rawContent)?.[1] || '';
      if (type || processingTime || requiredDocuments.length > 0 || notes) {
        return { type, processingTime, requiredDocuments, notes };
      }
      return { content: rawContent };
    }

    const structured = parseVisaRequirements(visaContent);
    logger.info('[POST /visa-requirements] Sending success response.');
    res.json({
      status: 'success',
      visaRequirements: structured
    });
  } catch (error) {
    logger.error(`[POST /visa-requirements] !!! Error caught in route handler: ${error.message}`);
    res.status(502).json({
      status: 'error',
      message: 'Failed to retrieve visa requirements from the information service.',
      details: error.message 
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Visa Requirements Server started successfully on port ${PORT}`);
  logger.info(`Configured to query LLM at: ${BRAVE_MCP_URL}${BRAVE_API_ENDPOINT}`);
  if (BRAVE_MCP_URL.includes(':8000')) {
      logger.warn('Potential Misconfiguration: BRAVE_MCP_URL seems to point to the gateway (port 8000). Ensure it points to the correct LLM/Brave service.');
  }
});