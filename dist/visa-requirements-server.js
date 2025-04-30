"use strict";
// visa-requirements-server.js
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
require('dotenv').config(); // Load .env file variables
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createServerLogger } = require('./server-logger'); // Adjust path if needed
// const { createRequestLogger } = require('./request-logger'); // Removed - Caused crash
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
// app.use(createRequestLogger(logger)); // Removed - Caused crash
// --- Helper: Call Brave/LLM Service ---
function getVisaInfoFromLLM(nationality, destination) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const targetUrl = `${BRAVE_MCP_URL}${BRAVE_API_ENDPOINT}`;
        logger.info(`Querying LLM at ${targetUrl} for visa: ${nationality} -> ${destination}`);
        const payload = {
            messages: [
                {
                    role: 'user',
                    content: `What are the visa requirements for a ${nationality} citizen traveling to ${destination}? Please provide detailed information about visa types, required documents, application process, fees, validity, length of stay, and any specific warnings or important notes.`
                }
            ]
        };
        try {
            logger.info(`[getVisaInfoFromLLM] >>> Preparing to POST to ${targetUrl}`, { payload: JSON.stringify(payload) }); // Log payload
            const response = yield axios.post(targetUrl, payload, { timeout: REQUEST_TIMEOUT });
            logger.info(`[getVisaInfoFromLLM] <<< Successfully received response from ${targetUrl}`, { status: response.status }); // Log success
            // **Adapt this based on the ACTUAL response structure of your Brave/LLM endpoint**
            // Trying common structures:
            const content = ((_d = (_c = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.choices) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content // OpenAI-like structure
            )
                || ((_f = (_e = response.data) === null || _e === void 0 ? void 0 : _e.message) === null || _f === void 0 ? void 0 : _f.content) // Simple message structure
                || ((_g = response.data) === null || _g === void 0 ? void 0 : _g.content) // Direct content
                || JSON.stringify(response.data); // Fallback: Stringify the whole data
            if (!content || content === '{}' || content === '""') {
                logger.warn(`LLM returned empty or invalid content for ${nationality} -> ${destination}`);
                return "Visa information service did not provide specific details.";
            }
            logger.info(`Successfully received visa info from LLM for ${nationality} -> ${destination}`);
            return content.trim();
        }
        catch (error) {
            const status = (_h = error.response) === null || _h === void 0 ? void 0 : _h.status;
            const errorData = (_j = error.response) === null || _j === void 0 ? void 0 : _j.data;
            const errorCode = error.code; // Get error code (e.g., ECONNREFUSED, ETIMEDOUT)
            logger.error(`[getVisaInfoFromLLM] !!! Error calling LLM (${targetUrl}): ${error.message}`, { status, errorCode, errorData: JSON.stringify(errorData) }); // Log error details
            // Throw a more specific error based on the code
            if (errorCode === 'ECONNREFUSED') {
                throw new Error(`LLM service connection refused at ${targetUrl}`);
            }
            else if (errorCode === 'ETIMEDOUT') {
                throw new Error(`LLM service request timed out at ${targetUrl}`);
            }
            else {
                throw new Error(`LLM service request failed with status ${status || 'unknown'} (Code: ${errorCode || 'N/A'})`);
            }
        }
    });
}
// --- API Routes ---
// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'visa-requirements-service' });
});
// Get Visa Requirements
app.post('/visa-requirements', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
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
        logger.info(`[POST /visa-requirements] ---> Calling getVisaInfoFromLLM for ${nationality} -> ${destination}`);
        const visaContent = yield getVisaInfoFromLLM(nationality, destination);
        logger.info(`[POST /visa-requirements] <--- Received content from LLM. Length: ${(visaContent === null || visaContent === void 0 ? void 0 : visaContent.length) || 0}`);
        // --- Parse the LLM response into structured fields ---
        function parseVisaRequirements(rawContent) {
            var _a, _b, _c;
            // Simple regex-based parser for demonstration
            const type = ((_a = /Type:\s*(.+)/i.exec(rawContent)) === null || _a === void 0 ? void 0 : _a[1]) || '';
            const processingTime = ((_b = /Processing Time:\s*(.+)/i.exec(rawContent)) === null || _b === void 0 ? void 0 : _b[1]) || '';
            const requiredDocumentsMatch = /Required Documents:\s*([\s\S]*?)(?:\n[A-Z][a-z]+:|$)/i.exec(rawContent);
            const requiredDocuments = requiredDocumentsMatch
                ? requiredDocumentsMatch[1].split('\n').map(line => line.replace(/^- /, '').trim()).filter(Boolean)
                : [];
            const notes = ((_c = /Notes:\s*([\s\S]*)/i.exec(rawContent)) === null || _c === void 0 ? void 0 : _c[1]) || '';
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
    }
    catch (error) {
        // Log the specific error received from the helper
        logger.error(`[POST /visa-requirements] !!! Error caught in route handler: ${error.message}`);
        // Error should already be logged in detail by the helper function
        res.status(502).json({
            status: 'error',
            message: 'Failed to retrieve visa requirements from the information service.',
            details: error.message // Pass cleaner error message
        });
    }
}));
// --- Server Start ---
app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Visa Requirements Server started successfully on port ${PORT}`);
    logger.info(`Configured to query LLM at: ${BRAVE_MCP_URL}${BRAVE_API_ENDPOINT}`);
    // Add a warning if the default URL looks like the gateway itself
    if (BRAVE_MCP_URL.includes(':8000')) {
        logger.warn('Potential Misconfiguration: BRAVE_MCP_URL seems to point to the gateway (port 8000). Ensure it points to the correct LLM/Brave service.');
    }
});
