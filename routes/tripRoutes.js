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

const router = express.Router();
const logger = createServerLogger('TripRoutes');

// Generate travel plan
router.post('/generate',
  validateTravelPlanInput,
  debounceRequests(2000),
  async (req, res) => {
    logger.info('[TripRoutes] /generate Raw request body:', JSON.stringify(req.body, null, 2));
    try {
      // Destructure using expected frontend names (camelCase)
      const {
        destination,
        days,
        budget, // Assuming budget comes as string/number matching schema 'text' type after mapping?
        interests = [],
        userCountry = '', // Frontend might send userCountry directly now
        nationality = '', // Or it might send nationality
        travelDates = '',
        travelStyle = '', // Frontend likely sends travelStyle
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
      const itinerary = await aiService.generateItinerary({
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
      await tripService.createTrip(dbTripData); // Pass dbTripData now
      logger.info('Trip saved successfully');

      res.json(createSuccessResponse({
        tripId: dbTripData.id, // Use the generated ID
        itinerary // Return the generated itinerary
      }, {
        processingTime: Date.now() - startTime,
        source: 'ai_service'
      }));
    } catch (error) {
      // ... existing error handling ...
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

// ... rest of tripRoutes.js ...

module.exports = router;

// ----- Also, update tripService.js -----

// AldaleelApp-MCP/services/tripService.js
const { supabase } = require('../config/supabaseClient');
const { createServerLogger } = require('../server-logger');

const logger = createServerLogger('TripService');

class TripService {
  async createTrip(dbTripData) { // Parameter name changed for clarity
    try {
      // Remove the budget mapping logic here, as the schema expects text
      // and the route handler now passes the budget value directly.
      // The object passed should now have keys matching DB columns.
      const dataToInsert = { ...dbTripData }; // Use the passed object directly

      logger.info('Inserting into trips table:', JSON.stringify(dataToInsert, null, 2));

      const { data, error } = await supabase
        .from('trips')
        .insert([dataToInsert])
        .select(); // Optionally select the inserted data back

      if (error) {
          logger.error('Supabase insert error:', JSON.stringify(error, null, 2));
          throw error;
      }
      logger.info('Supabase insert success:', data);
      // Return the first element from the data array returned by .select()
      return data ? data[0] : null;
    } catch (error) {
      logger.error('Error creating trip:', error);
      throw error; // Re-throw the original error
    }
  }

  // ... other methods (getTripById, getTrips, updateTrip) ...
  // Ensure these methods also handle potential camelCase vs snake_case issues if necessary,
  // although SELECT operations are often less problematic than INSERT/UPDATE.

  async getTripById(tripId) {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*') // Selects all columns (using their DB names)
        .eq('id', tripId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // Specific Supabase code for "Not Found" on .single()
          logger.warn(`Trip not found with ID: ${tripId}`);
          return null;
        }
        throw error; // Rethrow other errors
      }
      // Supabase client returns data with keys matching DB columns (snake_case)
      // If needed, you could map these back to camelCase here before returning
      return data;
    } catch (error) {
      logger.error('Error getting trip:', error);
      throw error;
    }
  }

  async getTrips(page = 1, limit = 10) {
    try {
      const { data, count, error } = await supabase
        .from('trips')
        .select('*', { count: 'exact' })
        .order('createdAt', { ascending: false }) // Example order
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;

      // Data keys will be snake_case
      return {
        data,
        pagination: {
          currentPage: page, // Renamed for clarity
          pageSize: limit, // Renamed for clarity
          totalCount: count,
          totalPages: Math.ceil(count / limit),
        }
      };
    } catch (error) {
      logger.error('Error getting trips:', error);
      throw error;
    }
  }

   async updateTrip(tripId, newData) {
    try {
      // Ensure keys in newData match DB columns (snake_case)
      // You might need mapping here if newData comes from frontend with camelCase
      const dataToUpdate = { ...newData }; // Assume newData has snake_case keys for now
      // Example mapping if needed:
      // const dataToUpdate = {
      //   user_country: newData.userCountry,
      //   travel_style: newData.travelStyle,
      //   // ... map other fields
      // };

      const { data, error } = await supabase
        .from('trips')
        .update(dataToUpdate)
        .eq('id', tripId)
        .select(); // Select updated row

      if (error) throw error;
      return data ? data[0] : null; // Return updated row
    } catch (error) {
      logger.error('Error updating trip:', error);
      throw error;
    }
  }

}

module.exports = new TripService();