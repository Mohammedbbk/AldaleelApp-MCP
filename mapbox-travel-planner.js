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
  
} catch (error) {
  logger.error(`[${SERVICE_NAME} Error] Failed to initialize Mapbox client:`, error);
  // Depending on severity, you might want to prevent the server from starting
  // or handle this state gracefully in the route handlers.
  console.error(`[${SERVICE_NAME} Error] Initialization failed: ${error.message}`); 
}

app.post('/directions', async (req, res) => {
  try {
    if (!baseClient || !directionsService) {
      logger.error(`[${SERVICE_NAME} Error] Attempted to get directions but service is not available (Initialization failed?).`);
      return res.status(503).json({
        error: 'Mapbox service unavailable - Initialization likely failed.'
      });
    }
    const { origin, destination, waypoints } = req.body;

    const response = await directionsService
      .getDirections({
        points: [origin, ...(waypoints || []), destination],
        profile: 'driving',
        geometries: 'geojson'
      })
      .send();

    res.json(response.body);
  } catch (error) {
    logger.error('Error getting directions:', error);
    res.status(500).json({
      error: 'Failed to get directions',
      details: error.message
    });
  }
});

app.post('/enhance-trip', async (req, res) => {
  try {
    if (!baseClient || !directionsService) {
      logger.error(`[${SERVICE_NAME} Error] Service not available (Initialization failed?).`);
      return res.status(503).json({
        error: 'Mapbox service unavailable'
      });
    }
    
    const { itinerary, destination, latitude, longitude } = req.body;
    
    if (!itinerary || !destination) {
      return res.status(400).json({
        error: 'Missing required parameters: itinerary and destination'
      });
    }
    
    // Simple enhancement: Add location coordinates to each day's activities
    const enhancedItinerary = {...itinerary};
    
    if (enhancedItinerary.Days && Array.isArray(enhancedItinerary.Days)) {
      enhancedItinerary.Days = enhancedItinerary.Days.map(day => {
        return {
          ...day,
          MapInfo: {
            coordinates: {
              latitude,
              longitude
            },
            locationName: destination
          }
        };
      });
    }
    
    logger.info(`Enhanced itinerary for ${destination} with Mapbox data`);
    
    res.json({
      status: 'success',
      enhancedItinerary
    });
  } catch (error) {
    logger.error('Error enhancing trip:', error);
    res.status(500).json({
      error: 'Failed to enhance trip',
      details: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.TRAVEL_PLANNER_PORT || 8004;
const server = app.listen(PORT, '0.0.0.0', () => { // Listen on all interfaces
  logger.info(`[${SERVICE_NAME}] Server listening successfully on port ${PORT}`);
  console.log(`[${SERVICE_NAME}] Server listening successfully on port ${PORT}`); // Explicit console log for startup
});

server.on('error', (error) => {
  logger.error(`[${SERVICE_NAME} Server Error] Failed to start server:`, error);
  console.error(`[${SERVICE_NAME} Server Error] Failed to start server: ${error.code} - ${error.message}`);
  process.exit(1); // Exit if the server fails to start (e.g., port conflict)
});