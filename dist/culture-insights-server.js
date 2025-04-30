"use strict";
// culture-insights-server.js
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
const PORT = process.env.CULTURE_INSIGHTS_PORT || 8008; // Use a new default port
// Point to the same LLM service as the visa server
const LLM_SERVICE_URL = process.env.BRAVE_MCP_URL || `http://localhost:${process.env.BRAVE_PORT || 3002}`;
const LLM_API_ENDPOINT = process.env.BRAVE_API_ENDPOINT || '/api/chat';
const REQUEST_TIMEOUT = parseInt(process.env.CULTURE_REQUEST_TIMEOUT) || 30000; // 30 seconds timeout
// --- Initialization ---
const app = express();
const logger = createServerLogger('CultureInsights');
// --- Middleware ---
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse incoming JSON requests
// app.use(createRequestLogger(logger)); // Removed - Caused crash
// --- Helper: Call LLM Service ---
function getCultureInsightsFromLLM(nationality, destination) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const targetUrl = `${LLM_SERVICE_URL}${LLM_API_ENDPOINT}`;
        logger.info(`Querying LLM at ${targetUrl} for culture insights: ${nationality} -> ${destination}`);
        const payload = {
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
            ]
        };
        try {
            // --- ADDED DEBUG LOG (Modified) --- 
            logger.info(`[getCultureInsightsFromLLM] >>> Preparing to POST to ${targetUrl}`, { payload: JSON.stringify(payload) });
            const response = yield axios.post(targetUrl, payload, { timeout: REQUEST_TIMEOUT });
            // --- ADDED SUCCESS LOG ---
            logger.info(`[getCultureInsightsFromLLM] <<< Successfully received response from ${targetUrl}`, { status: response.status });
            // Adapt this based on the ACTUAL response structure of your LLM endpoint
            const content = ((_d = (_c = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.choices) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content // OpenAI-like structure
            )
                || ((_f = (_e = response.data) === null || _e === void 0 ? void 0 : _e.message) === null || _f === void 0 ? void 0 : _f.content) // Simple message structure
                || ((_g = response.data) === null || _g === void 0 ? void 0 : _g.content) // Direct content
                || JSON.stringify(response.data); // Fallback: Stringify the whole data
            if (!content || content === '{}' || content === '""') {
                logger.warn(`LLM returned empty or invalid content for culture insights: ${nationality} -> ${destination}`);
                return "Cultural information service did not provide specific details.";
            }
            logger.info(`Successfully received culture insights from LLM for ${nationality} -> ${destination}`);
            return content.trim();
        }
        catch (error) {
            const status = (_h = error.response) === null || _h === void 0 ? void 0 : _h.status;
            const errorData = (_j = error.response) === null || _j === void 0 ? void 0 : _j.data;
            const errorCode = error.code; // Get error code
            // --- ADDED DEBUG LOG (Modified) ---
            logger.error(`[getCultureInsightsFromLLM] !!! Error calling LLM (${targetUrl}): ${error.message}`, { status, errorCode, errorData: JSON.stringify(errorData) });
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
    res.status(200).json({ status: 'ok', service: 'culture-insights-service' });
});
// Get Culture Insights
app.post('/culture-insights', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    logger.info('>>> POST /culture-insights HANDLER REACHED <<<', { body: req.body });
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
        // --- ADDED BEFORE LOG --- 
        logger.info(`[POST /culture-insights] ---> Calling getCultureInsightsFromLLM for ${nationality} -> ${destination}`);
        const cultureContent = yield getCultureInsightsFromLLM(nationality, destination);
        // --- ADDED AFTER LOG ---
        logger.info(`[POST /culture-insights] <--- Received content from LLM. Length: ${(cultureContent === null || cultureContent === void 0 ? void 0 : cultureContent.length) || 0}`);
        function parseCultureInsights(rawContent) {
            var _a, _b, _c, _d;
            // Similar parsing logic as visa (adapt fields as needed)
            const etiquette = ((_a = /Etiquette:\s*(.+)/i.exec(rawContent)) === null || _a === void 0 ? void 0 : _a[1]) || '';
            const dressCode = ((_b = /Dress Code:\s*(.+)/i.exec(rawContent)) === null || _b === void 0 ? void 0 : _b[1]) || '';
            const communication = ((_c = /Communication:\s*(.+)/i.exec(rawContent)) === null || _c === void 0 ? void 0 : _c[1]) || '';
            const customs = /Customs & Traditions:\s*([\s\S]*?)(?:\n[A-Z][a-z]+:|$)/i.exec(rawContent);
            const keyCustoms = customs
                ? customs[1].split('\n').map(line => line.replace(/^- /, '').trim()).filter(Boolean)
                : [];
            const notes = ((_d = /Notes:\s*([\s\S]*)/i.exec(rawContent)) === null || _d === void 0 ? void 0 : _d[1]) || '';
            if (etiquette || dressCode || communication || keyCustoms.length > 0 || notes) {
                return { etiquette, dressCode, communication, keyCustoms, notes };
            }
            return { content: rawContent };
        }
        const structured = parseCultureInsights(cultureContent);
        // --- ADDED RESPONSE LOG ---
        logger.info('[POST /culture-insights] Sending success response.');
        res.json({
            status: 'success',
            cultureInsights: structured
        });
    }
    catch (error) {
        // --- ADDED ERROR LOG ---
        logger.error(`[POST /culture-insights] !!! Error caught in route handler: ${error.message}`);
        // Error should already be logged in detail by the helper function
        res.status(502).json({
            status: 'error',
            message: 'Failed to retrieve culture insights from the information service.',
            details: error.message // Pass cleaner error message
        });
    }
}));
// --- Server Start ---
app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Culture Insights Server started successfully on port ${PORT}`);
    logger.info(`Configured to query LLM at: ${LLM_SERVICE_URL}${LLM_API_ENDPOINT}`);
});
