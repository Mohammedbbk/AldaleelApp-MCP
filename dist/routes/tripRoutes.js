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
const { validateTravelPlanInput } = require('../middleware/validateInput');
const tripService = require('../services/tripService');
const aiService = require('../services/aiService');
const { createServerLogger } = require('../server-logger');
const { v4: uuidv4 } = require('uuid');
const { createSuccessResponse, createErrorResponse, validateResponse, cacheResponse, debounceRequests } = require('../middleware/responseValidation');
const router = express.Router();
const logger = createServerLogger('TripRoutes');
// Generate travel plan
router.post('/generate', validateTravelPlanInput, debounceRequests(2000), // 2 second debounce
(req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    logger.info('[TripRoutes] /generate Raw request body:', JSON.stringify(req.body, null, 2));
    try {
        const { destination, days, budget, interests = [], userCountry = '', travelDates = '', travelStyle = '', dietaryRestrictions = [] } = req.body;
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
        const startTime = Date.now();
        const itinerary = yield aiService.generateItinerary({
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
            userCountry,
            travelDates,
            travelStyle,
            dietaryRestrictions,
            itinerary,
            createdAt: new Date().toISOString()
        };
        yield tripService.createTrip(tripData);
        logger.info('Trip saved successfully');
        res.json(createSuccessResponse({
            tripId,
            itinerary
        }, {
            processingTime: Date.now() - startTime,
            source: 'ai_service'
        }));
    }
    catch (error) {
        logger.error('[TripRoutes] AI service error response data:', (_a = error.response) === null || _a === void 0 ? void 0 : _a.data);
        logger.error('Error generating travel plan:', error);
        logger.error('Error stack:', error.stack);
        const statusCode = ((_b = error.response) === null || _b === void 0 ? void 0 : _b.status) || 500;
        const errorResponse = createErrorResponse(error.code || 'INTERNAL_SERVER_ERROR', 'Failed to generate travel plan', error.message, [
            'Try adjusting your travel parameters',
            'Check if the destination is valid',
            'Try again in a few minutes'
        ]);
        if ((_c = error.response) === null || _c === void 0 ? void 0 : _c.data) {
            errorResponse.serviceError = error.response.data;
        }
        res.status(statusCode).json(errorResponse);
    }
}));
// Get trip by ID
router.get('/:tripId', cacheResponse(60000), // Cache for 1 minute
(req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { tripId } = req.params;
        const startTime = Date.now();
        const trip = yield tripService.getTripById(tripId);
        if (!trip) {
            return res.status(404).json(createErrorResponse('NOT_FOUND', 'Trip not found', `No trip found with ID: ${tripId}`, ['Check if the trip ID is correct', 'Try searching for your trip']));
        }
        res.json(createSuccessResponse(trip, {
            processingTime: Date.now() - startTime,
            source: 'database',
            cached: false
        }));
    }
    catch (error) {
        logger.error('Error retrieving trip:', error);
        res.status(500).json(createErrorResponse('INTERNAL_SERVER_ERROR', 'Failed to retrieve trip data', error.message, ['Try again in a few moments']));
    }
}));
// Get all trips with pagination
router.get('/', cacheResponse(30000), // Cache for 30 seconds
(req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const startTime = Date.now();
        const result = yield tripService.getTrips(page, limit);
        res.json(createSuccessResponse({
            trips: result.data,
            pagination: result.pagination
        }, {
            processingTime: Date.now() - startTime,
            source: 'database',
            cached: false
        }));
    }
    catch (error) {
        logger.error('Error retrieving trips:', error);
        res.status(500).json(createErrorResponse('INTERNAL_SERVER_ERROR', 'Failed to retrieve trips', error.message, ['Try refreshing the page', 'Adjust the pagination parameters']));
    }
}));
// Chat with AI assistant for trip planning
router.post('/chat', debounceRequests(1000), // 1 second debounce
(req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    logger.info('[TripRoutes] /chat Raw request body:', JSON.stringify(req.body, null, 2));
    try {
        const { message, context, tripData } = req.body;
        const startTime = Date.now();
        if (!message) {
            return res.status(400).json(createErrorResponse('MISSING_MESSAGE', 'Message is required', 'The message field cannot be empty', ['Please provide a message to continue the conversation']));
        }
        logger.info('Processing chat request:', { message, context });
        // Build the prompt with improved context handling
        let prompt = `You are Al-Daleel, a helpful travel assistant. As a knowledgeable travel guide, provide clear, concise information.`;
        if (tripData) {
            prompt += `\n\nContext from previous conversation:\n`;
            prompt += `- Destination: ${tripData.destination || 'Not specified'}\n`;
            prompt += `- Duration: ${tripData.days || tripData.duration || 'Not specified'} days\n`;
            prompt += `- Budget: ${tripData.budget || 'Not specified'}\n`;
            prompt += `- Travel style: ${tripData.travelStyle || 'Not specified'}\n`;
            prompt += `- Interests: ${tripData.interests ? tripData.interests.join(', ') : 'Not specified'}\n`;
            if ((_a = tripData.conversation) === null || _a === void 0 ? void 0 : _a.summary) {
                prompt += `\nPrevious conversation summary: ${tripData.conversation.summary}\n`;
            }
        }
        prompt += `\nUser message: ${message}\n`;
        prompt += `\nRespond naturally as a helpful travel assistant. If the user is asking about modifying a trip plan, suggest helpful changes. If they're asking for information, provide accurate travel advice.`;
        // Call the AI service with improved error handling
        const response = yield fetch(`http://127.0.0.1:${process.env.AI_SERVER_PORT || 8001}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
        });
        if (!response.ok) {
            const errorData = yield response.json();
            logger.error('AI service error:', errorData);
            throw new Error(errorData.message || 'AI service error');
        }
        const aiData = yield response.json();
        // Extract and validate the response content
        let responseContent;
        try {
            const content = aiData.data.content;
            const parsed = JSON.parse(content);
            responseContent = parsed.response || parsed.message || content;
        }
        catch (error) {
            responseContent = aiData.data.content;
        }
        // Create a chat message response
        const chatMessage = {
            role: 'assistant',
            content: responseContent,
            timestamp: new Date().toISOString(),
            metadata: {
                confidence: aiData.data.confidence,
                processingTime: Date.now() - startTime
            }
        };
        res.json(createSuccessResponse({
            message: chatMessage,
            conversation: {
                id: uuidv4(),
                context: context || 'general',
                summary: (_b = tripData === null || tripData === void 0 ? void 0 : tripData.conversation) === null || _b === void 0 ? void 0 : _b.summary
            }
        }, {
            processingTime: Date.now() - startTime,
            source: 'ai_service'
        }));
    }
    catch (error) {
        logger.error('Error generating chat response:', error);
        logger.error('Error stack:', error.stack);
        res.status(500).json(createErrorResponse('CHAT_ERROR', 'Failed to generate response', error.message, [
            'Try rephrasing your question',
            'Check your internet connection',
            'Try again in a few moments'
        ]));
    }
}));
module.exports = router;
