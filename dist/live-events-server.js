"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');
const { createServerLogger, createRequestLogger } = require('./server-logger');
dotenv.config();
const app = express();
const logger = createServerLogger('LiveEvents');
const SERVICE_NAME = 'Live Events';
app.use(cors());
app.use(express.json());
const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;
const TICKETMASTER_API_URL = 'https://app.ticketmaster.com/discovery/v2';
try {
    if (!TICKETMASTER_API_KEY) {
        logger.warn(`[${SERVICE_NAME}] TICKETMASTER_API_KEY environment variable not set.`);
    }
    else {
        logger.info(`[${SERVICE_NAME}] Ticketmaster API Key loaded.`);
    }
}
catch (error) {
    logger.error(`[${SERVICE_NAME} Error] Initialization check failed:`, error);
    console.error(`[${SERVICE_NAME} Error] Initialization check failed: ${error.message}`);
}
function getEvents(location, startDate, endDate) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios.get(`${TICKETMASTER_API_URL}/events.json`, {
                params: {
                    apikey: TICKETMASTER_API_KEY,
                    city: location,
                    startDateTime: startDate,
                    endDateTime: endDate,
                    size: 20
                }
            });
            return response.data;
        }
        catch (error) {
            logger.error('Error fetching events:', error);
            throw error;
        }
    });
}
app.post('/events', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!TICKETMASTER_API_KEY) {
            logger.error(`[${SERVICE_NAME} Error] Attempted to fetch events but API key is missing.`);
            return res.status(503).json({
                error: 'Ticketmaster service unavailable - API key missing'
            });
        }
        const { location, startDate, endDate } = req.body;
        if (!location || !startDate || !endDate) {
            return res.status(400).json({
                error: 'Missing required parameters: location, startDate, and endDate'
            });
        }
        const events = yield getEvents(location, startDate, endDate);
        res.json(events);
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to fetch events',
            details: error.message
        });
    }
}));
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
const PORT = process.env.LIVE_EVENTS_PORT || 8005;
const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`[${SERVICE_NAME}] Server listening successfully on port ${PORT}`);
    console.log(`[${SERVICE_NAME}] Server listening successfully on port ${PORT}`);
    if (!TICKETMASTER_API_KEY) {
        logger.warn(`[${SERVICE_NAME}] Server started, but Ticketmaster API key is MISSING.`);
    }
});
server.on('error', (error) => {
    logger.error(`[${SERVICE_NAME} Server Error] Failed to start server:`, error);
    console.error(`[${SERVICE_NAME} Server Error] Failed to start server: ${error.code} - ${error.message}`);
    process.exit(1);
});
