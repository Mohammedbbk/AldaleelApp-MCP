const express = require('express');
const { validateTravelPlanInput } = require('../middleware/validateInput');
const tripService = require('../services/tripService');
const aiService = require('../services/aiService');
const { createServerLogger } = require('../server-logger');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const logger = createServerLogger('TripRoutes');

// Generate travel plan
router.post('/generate', validateTravelPlanInput, async (req, res) => {
  try {
    const {
      destination,
      
      days,
      budget,
      interests = [],
      userCountry = '',
      travelDates = '',
      travelStyle = '',
      dietaryRestrictions = []
    } = req.body;

    logger.info('Processing travel plan request:', {
      destination,
      days,
      budget,
      interests,
      userCountry,
      travelDates,
      travelStyle,
      dietaryRestrictions
    });

    const tripId = uuidv4();
    const itinerary = await aiService.generateItinerary({
      destination,
      days,
      budget,
      interests,
      userCountry,
      travelDates,
      travelStyle,
      dietaryRestrictions
    });

    const tripData = {
      id: tripId,
      destination,
      days,
      budget,
      interests,
      user_country: userCountry,
      travel_dates: travelDates,
      travel_style: travelStyle,
      dietary_restrictions: dietaryRestrictions,
      itinerary,
      created_at: new Date().toISOString()
    };

    await tripService.createTrip(tripData);
    logger.info('Trip saved successfully');

    res.json({
      status: 'success',
      data: {
        tripId,
        itinerary
      }
    });
  } catch (error) {
    logger.error('Error generating travel plan:', error);
    logger.error('Error stack:', error.stack);

    const statusCode = error.response?.status || 500;
    const errorResponse = {
      status: 'error',
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: 'Failed to generate travel plan',
      details: error.message,
      timestamp: new Date().toISOString()
    };

    if (error.response?.data) {
      errorResponse.serviceError = error.response.data;
    }

    res.status(statusCode).json(errorResponse);
  }
});

// Get trip by ID
router.get('/:tripId', async (req, res) => {
  try {
    const { tripId } = req.params;
    const trip = await tripService.getTripById(tripId);

    if (!trip) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: 'Trip not found'
      });
    }

    res.json({
      status: 'success',
      data: trip
    });
  } catch (error) {
    logger.error('Error retrieving trip:', error);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to retrieve trip data',
      details: error.message
    });
  }
});

// Get all trips with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await tripService.getTrips(page, limit);
    res.json({
      status: 'success',
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Error retrieving trips:', error);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to retrieve trips',
      details: error.message
    });
  }
});

module.exports = router;