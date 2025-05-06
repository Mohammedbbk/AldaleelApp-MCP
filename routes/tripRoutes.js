const express = require('express');
const { validateTravelPlanInput } = require('../middleware/validateInput');
const tripService = require('../services/tripService');
const aiService = require('../services/aiService');
const { createServerLogger } = require('../server-logger');
const { v4: uuidv4 } = require('uuid');
const { 
  createSuccessResponse, 
  createErrorResponse, 
  validateResponse, 
  cacheResponse, 
  debounceRequests 
} = require('../middleware/responseValidation');
const axios = require('axios');

const router = express.Router();
const logger = createServerLogger('TripRoutes');

router.post('/generate',
  validateTravelPlanInput,
  debounceRequests(2000),
  async (req, res) => {
    logger.info('[TripRoutes] /generate Raw request body:', JSON.stringify(req.body, null, 2));
    try {
      const {
        destination,
        days,
        budget, 
        interests = [],
        userCountry = '', 
        nationality = '', 
        travelDates = '',
        travelStyle = '', 
        travelerStyle = '', 
        dietaryRestrictions = [] 
      } = req.body;

      const dbTripData = {
        id: uuidv4(), 
        destination: destination,
        days: days,
        budget: budget, 
        interests: interests,
        user_country: userCountry || nationality, 
        travel_dates: travelDates,
        travel_style: travelStyle || travelerStyle, 
        dietary_restrictions: dietaryRestrictions, 
      };

      logger.info('Processing travel plan request (mapped to DB keys):', dbTripData);

      const startTime = Date.now();

      const itinerary = await aiService.generateItinerary({
        destination,
        days,
        budget,
        interests,
        userCountry: dbTripData.user_country, 
        travelDates,
        travelStyle: dbTripData.travel_style, 
        dietaryRestrictions
      });

      dbTripData.itinerary = itinerary; 

      try {
        const backendPayload = {
          ...dbTripData,
          user_id: req.body.user_id,
          destinationCountry: req.body.destinationCountry || dbTripData.user_country || dbTripData.nationality,
          nationality: req.body.nationality || dbTripData.user_country,
          duration: req.body.duration || dbTripData.days,
          month: req.body.month,
          year: req.body.year,
          travelerStyle: req.body.travelerStyle || req.body.travelStyle || dbTripData.travel_style,
          budgetLevel: req.body.budgetLevel || dbTripData.budget,
          specialRequirements: req.body.specialRequirements || dbTripData.dietary_restrictions,
          transportationPreference: req.body.transportationPreference,
          displayDestination: req.body.displayDestination,
        };

        const backendResponse = await axios.post('http://localhost:5000/api/trips', backendPayload, { timeout: 15000 });
        logger.info('Trip posted to backend. Response status:', backendResponse.status);
      } catch (backendErr) {
        logger.error('Failed to store trip in backend:', backendErr.message);
      }

      res.json(createSuccessResponse({
        tripId: dbTripData.id, 
        itinerary 
      }, {
        processingTime: Date.now() - startTime,
        source: 'ai_service'
      }));
    } catch (error) {
      logger.error('[TripRoutes] AI service error response data:', error.response?.data);
      logger.error('Error generating travel plan:', error);
      logger.error('Error stack:', error.stack);

      const statusCode = error.response?.status || 500;
      const errorResponse = createErrorResponse(
        error.code || 'INTERNAL_SERVER_ERROR',
        'Failed to generate travel plan',
        error.message,
        [
          'Try adjusting your travel parameters',
          'Check if the destination is valid',
          'Try again in a few minutes'
        ]
      );
       if (error.response?.data) {
        errorResponse.serviceError = error.response.data;
      }
      res.status(statusCode).json(errorResponse);
    }
});

module.exports = router;

