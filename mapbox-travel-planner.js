const express = require('express');
const mbxClient = require('@mapbox/mapbox-sdk');
const mbxDirections = require('@mapbox/mapbox-sdk/services/directions');
const cors = require('cors');
const dotenv = require('dotenv');
const { createServerLogger, createRequestLogger } = require('./server-logger');

dotenv.config();
const app = express();
const logger = createServerLogger('TravelPlanner');

app.use(cors());
app.use(express.json());
app.use(createRequestLogger(logger));

// Make sure the MAPBOX_ACCESS_TOKEN is properly set in your .env file
// Check if the token is being loaded correctly
console.log('Mapbox token available:', !!process.env.MAPBOX_ACCESS_TOKEN);

// Add a fallback or error handling for missing token
const baseClient = process.env.MAPBOX_ACCESS_TOKEN 
  ? mbxClient({ accessToken: process.env.MAPBOX_ACCESS_TOKEN })
  : null;

const directionsService = baseClient 
  ? mbxDirections(baseClient) 
  : null;

app.post('/directions', async (req, res) => {
  try {
    if (!baseClient || !directionsService) {
      return res.status(503).json({
        error: 'Mapbox service unavailable - missing access token'
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

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.TRAVEL_PLANNER_PORT || 8004;
app.listen(PORT, () => {
  logger.info(`Travel Planner MCP Server running on port ${PORT}`);
});