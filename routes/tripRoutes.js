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
  // Log the raw request body received
  logger.info('[TripRoutes] /generate Raw request body:', JSON.stringify(req.body, null, 2));
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
    // Log AI service error response data if available
    logger.error('[TripRoutes] AI service error response data:', error.response?.data);
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

// Chat with AI assistant for trip planning
router.post('/chat', async (req, res) => {
  // Log the raw request body received
  logger.info('[TripRoutes] /chat Raw request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { message, context, tripData } = req.body;
    
    if (!message) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_MESSAGE',
        message: 'Message is required'
      });
    }

    logger.info('Processing chat request:', { message, context });

    // Build the prompt for the AI service
    let prompt = `You are Al-Daleel, a helpful travel assistant. As a knowledgeable travel guide, provide clear, concise information.`;
    
    // Add context about previous trip data if available
    if (tripData) {
      prompt += `\n\nThe user has previously shared the following travel details:
      - Destination: ${tripData.destination || 'Not specified'}
      - Duration: ${tripData.days || tripData.duration || 'Not specified'} days
      - Budget: ${tripData.budget || 'Not specified'}
      - Travel style: ${tripData.travelStyle || 'Not specified'}
      - Interests: ${tripData.interests ? tripData.interests.join(', ') : 'Not specified'}`;
    }

    // Add the user's message
    prompt += `\n\nUser message: ${message}`;
    
    // Add instructions for formatting the response
    prompt += `\n\nRespond naturally as a helpful travel assistant. If the user is asking about modifying a trip plan, suggest helpful changes. If they're asking for information, provide accurate travel advice.`;

    // Call the AI service with our built prompt
    const response = await fetch(`http://127.0.0.1:${process.env.AI_SERVER_PORT || 8001}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('AI service error:', errorData);
      throw new Error(errorData.message || 'AI service error');
    }

    const aiData = await response.json();
    
    // Extract the response content from the AI service response
    let responseContent;
    try {
      const content = aiData.data.content;
      const parsed = JSON.parse(content);
      responseContent = parsed.response || parsed.message || content;
    } catch (error) {
      // If parsing fails, just use the content as a string
      responseContent = aiData.data.content;
    }

    res.json({
      status: 'success',
      response: responseContent
    });
  } catch (error) {
    logger.error('Error generating chat response:', error);
    logger.error('Error stack:', error.stack);

    res.status(500).json({
      status: 'error',
      code: 'CHAT_ERROR',
      message: 'Failed to generate response',
      details: error.message
    });
  }
});

module.exports = router;