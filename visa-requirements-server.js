
require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createServerLogger } = require('./server-logger'); 

const PORT = process.env.VISA_REQUIREMENTS_PORT || 8009;
const BRAVE_MCP_URL = process.env.BRAVE_MCP_URL || `http://localhost:${process.env.BRAVE_PORT || 8010}`; 
const BRAVE_MCP_URL = process.env.BRAVE_MCP_URL || `http://localhost:${process.env.BRAVE_PORT || 8010}`; // Use port 8010 for Brave LLM
const BRAVE_API_ENDPOINT = process.env.BRAVE_API_ENDPOINT || '/api/chat'; 
const REQUEST_TIMEOUT = parseInt(process.env.VISA_REQUEST_TIMEOUT) || 25000; 

const app = express();

const logger = createServerLogger('VisaRequirements');

app.use(cors()); 
app.use(express.json()); 

async function getVisaInfoFromLLM(nationality, destination) {
  const targetUrl = `${BRAVE_MCP_URL}${BRAVE_API_ENDPOINT}`;
  logger.info(`Querying LLM at ${targetUrl} for visa: ${nationality} -> ${destination}`);

  const payload = {
    messages: [
      {
        role: 'user',
        content: `What are the visa requirements for a ${nationality} citizen traveling to ${destination === 'SA' ? 'Saudi Arabia' : destination}? Please provide detailed information about visa types, required documents, application process, fees, validity, length of stay, and any specific warnings or important notes.`
      }
    ]
  };

  try {
    logger.info(`[getVisaInfoFromLLM] >>> Preparing to POST to ${targetUrl}`, { payload: JSON.stringify(payload) }); // Log payload
    const response = await axios.post(
      targetUrl,
      payload,
      { timeout: REQUEST_TIMEOUT }
    );
    logger.info(`[getVisaInfoFromLLM] <<< Successfully received response from ${targetUrl}`, { status: response.status }); // Log success

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
    logger.error(`[getVisaInfoFromLLM] !!! Error calling LLM (${targetUrl}): ${error.message}`, { status, errorCode, errorData: JSON.stringify(errorData) }); // Log error details
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