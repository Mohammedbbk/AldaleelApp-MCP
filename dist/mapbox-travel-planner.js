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
const mbxClient = require('@mapbox/mapbox-sdk');
const mbxDirections = require('@mapbox/mapbox-sdk/services/directions');
const cors = require('cors');
const dotenv = require('dotenv');
const { createServerLogger, createRequestLogger } = require('./server-logger');
dotenv.config();
const app = express();
const logger = createServerLogger('TravelPlanner');
const SERVICE_NAME = 'Mapbox Travel Planner'; // Define service name
app.use(cors());
app.use(express.json());
// Removed: app.use(createRequestLogger(logger)); // Remove if request logger is not needed or causing issues
// Make sure the MAPBOX_ACCESS_TOKEN is properly set in your .env file
let baseClient = null;
let directionsService = null;
try {
    logger.info(`[${SERVICE_NAME}] Initializing Mapbox client...`);
    const mapboxApiKey = process.env.MAPBOX_API_KEY; // Use consistent env var name
    if (!mapboxApiKey) {
        logger.warn(`[${SERVICE_NAME}] MAPBOX_API_KEY environment variable not set.`);
        throw new Error('Mapbox API key is missing.');
    }
    baseClient = mbxClient({ accessToken: mapboxApiKey });
    directionsService = mbxDirections(baseClient);
    logger.info(`[${SERVICE_NAME}] Mapbox client initialized successfully.`);
}
catch (error) {
    logger.error(`[${SERVICE_NAME} Error] Failed to initialize Mapbox client:`, error);
    // Depending on severity, you might want to prevent the server from starting
    // or handle this state gracefully in the route handlers.
    console.error(`[${SERVICE_NAME} Error] Initialization failed: ${error.message}`);
}
app.post('/directions', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!baseClient || !directionsService) {
            logger.error(`[${SERVICE_NAME} Error] Attempted to get directions but service is not available (Initialization failed?).`);
            return res.status(503).json({
                error: 'Mapbox service unavailable - Initialization likely failed.'
            });
        }
        const { origin, destination, waypoints } = req.body;
        const response = yield directionsService
            .getDirections({
            points: [origin, ...(waypoints || []), destination],
            profile: 'driving',
            geometries: 'geojson'
        })
            .send();
        res.json(response.body);
    }
    catch (error) {
        logger.error('Error getting directions:', error);
        res.status(500).json({
            error: 'Failed to get directions',
            details: error.message
        });
    }
}));
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
const PORT = process.env.TRAVEL_PLANNER_PORT || 8004;
const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`[${SERVICE_NAME}] Server listening successfully on port ${PORT}`);
    console.log(`[${SERVICE_NAME}] Server listening successfully on port ${PORT}`); // Explicit console log for startup
});
server.on('error', (error) => {
    logger.error(`[${SERVICE_NAME} Server Error] Failed to start server:`, error);
    console.error(`[${SERVICE_NAME} Server Error] Failed to start server: ${error.code} - ${error.message}`);
    process.exit(1); // Exit if the server fails to start (e.g., port conflict)
});
