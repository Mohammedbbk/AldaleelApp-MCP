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
router.post('/generate', validateTravelPlanInput, debounceRequests(2000), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    logger.info('[TripRoutes] /generate Raw request body:', JSON.stringify(req.body, null, 2));
    try {
        // Destructure using expected frontend names (camelCase)
        const { destination, days, budget, // Assuming budget comes as string/number matching schema 'text' type after mapping?
        interests = [], userCountry = '', // Frontend might send userCountry directly now
        nationality = '', // Or it might send nationality
        travelDates = '', travelStyle = '', // Frontend likely sends travelStyle
        travelerStyle = '', // Or maybe travelerStyle
        dietaryRestrictions = [] // Frontend sends dietaryRestrictions
         } = req.body;
        // Map frontend names to exact DB column names (snake_case)
        const dbTripData = {
            id: uuidv4(), // Generate new ID
            destination: destination,
            days: days,
            budget: budget, // Use the budget value directly (schema is text)
            interests: interests,
            // Map JS camelCase to DB snake_case
            user_country: userCountry || nationality, // Use whichever is provided
            travel_dates: travelDates,
            travel_style: travelStyle || travelerStyle, // Use whichever is provided
            dietary_restrictions: dietaryRestrictions, // <<-- Use snake_case key
            // We get itinerary after AI call
            // createdAt is handled by default value in DB schema
        };
        logger.info('Processing travel plan request (mapped to DB keys):', dbTripData);
        const startTime = Date.now();
        // Call AI service (pass relevant data needed for prompt)
        const itinerary = yield aiService.generateItinerary({
            // Pass data needed by AI service prompt construction
            destination,
            days,
            budget,
            interests,
            userCountry: dbTripData.user_country, // Pass consistent value
            travelDates,
            travelStyle: dbTripData.travel_style, // Pass consistent value
            dietaryRestrictions
        });
        // Add itinerary to the data object going to the DB service
        dbTripData.itinerary = itinerary; // Add the generated itinerary
        // Call tripService with the object using snake_case keys
        yield tripService.createTrip(dbTripData); // Pass dbTripData now
        logger.info('Trip saved successfully');
        res.json(createSuccessResponse({
            tripId: dbTripData.id, // Use the generated ID
            itinerary // Return the generated itinerary
        }, {
            processingTime: Date.now() - startTime,
            source: 'ai_service'
        }));
    }
    catch (error) {
        // ... existing error handling ...
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
// ... rest of tripRoutes.js ...
module.exports = router;
// Move TripService to its own file
// The TripService code should be in services/tripService.js
