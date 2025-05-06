const express = require("express");
const router = express.Router();
const { createServerLogger } = require("../server-logger");
const axios = require("axios");
const env = require("../config/env");

const logger = createServerLogger("TripService");

const serviceTimeout = parseInt(process.env.CULTURE_REQUEST_TIMEOUT) || 30000;

const AI_REQUEST_TIMEOUT = 120000; 

router.use((req, res, next) => {
  req.setTimeout(serviceTimeout);
  logger.info(`[TripService] ${req.method} ${req.originalUrl}`, {
    query: req.query,
    headers: req.headers,
    timeout: serviceTimeout,
  });
  next();
});

router.get("/", async (req, res) => {
  try {
    const response = await axios.get("http://localhost:5000/api/trips", {
      params: {
        page: req.query.page || 1,
        limit: req.query.limit || 10,
        filter: req.query.filter || "all",
        sort: req.query.sort || "date",
        search: req.query.search || "",
        user_id: req.query.user_id,
      },
    });

    return res.status(200).json(response.data);
  } catch (error) {
    logger.error("Failed to fetch trips:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch trips",
      error: error.message,
    });
  }
});

router.post("/generate", async (req, res) => {
  req.setTimeout(120000);

  try {
    logger.info("[TripService] Received generation request:", req.body);

    res.setHeader("Connection", "keep-alive");
    res.setHeader("Keep-Alive", "timeout=120");

    // Step 1: Get the base itinerary from OpenAI
    logger.info("[TripService] Step 1: Requesting base itinerary from OpenAI");
    const openaiResponse = await axios.post(
      `http://localhost:${env.AI_SERVER_PORT}/generate`,
      {
        prompt: buildTripPrompt(req.body),
      },
      {
        timeout: 110000,
        headers: {
          Connection: "keep-alive",
        },
      }
    );

    if (!openaiResponse.data || !openaiResponse.data.data || !openaiResponse.data.data.content) {
      throw new Error("Invalid response from OpenAI server");
    }

    let enhancedPlan = openaiResponse.data.data.content;
    logger.info("[TripService] Base itinerary generated successfully");

    // Step 2: Enhance with Mapbox travel data
    try {
      logger.info("[TripService] Step 2: Enhancing with Mapbox travel data");
      const mapboxResponse = await axios.post(
        `http://localhost:${env.TRAVEL_PLANNER_PORT || 8004}/enhance-trip`,
        {
          itinerary: enhancedPlan,
          destination: req.body.destination,
          latitude: req.body.latitude,
          longitude: req.body.longitude
        },
        { timeout: 30000 }
      );
      
      if (mapboxResponse.data && mapboxResponse.data.enhancedItinerary) {
        enhancedPlan = mapboxResponse.data.enhancedItinerary;
        logger.info("[TripService] Successfully enhanced with travel data");
      }
    } catch (mapboxError) {
      logger.error("[TripService] Failed to enhance with travel data:", mapboxError.message);
      // Continue with original plan if enhancement fails
    }

    // Step 3: Add local events information
    try {
      logger.info("[TripService] Step 3: Adding local events");
      const eventsResponse = await axios.post(
        `http://localhost:${env.LIVE_EVENTS_PORT || 8005}/events`,
        {
          destination: req.body.destination,
          startDate: req.body.year + "-" + req.body.month,
          duration: req.body.duration
        },
        { timeout: 30000 }
      );
      
      if (eventsResponse.data && eventsResponse.data.events) {
        // Add events to the appropriate days in the itinerary
        eventsResponse.data.events.forEach(event => {
          const dayIndex = determineDayForEvent(event, enhancedPlan.Days);
          if (dayIndex >= 0 && dayIndex < enhancedPlan.Days.length) {
            // Add as a note or additional activity in the evening
            if (!enhancedPlan.Days[dayIndex].Notes) {
              enhancedPlan.Days[dayIndex].Notes = [];
            }
            enhancedPlan.Days[dayIndex].Notes.push(`Event: ${event.name} at ${event.venue}. Time: ${event.time}`);
          }
        });
        logger.info("[TripService] Successfully added local events");
      }
    } catch (eventsError) {
      logger.error("[TripService] Failed to add local events:", eventsError.message);
      // Continue without events if this fails
    }

    // Step 4: Enhance visa requirements
    try {
      logger.info("[TripService] Step 4: Enhancing visa requirements");
      const visaResponse = await axios.post(
        `http://localhost:${env.VISA_REQUIREMENTS_PORT || 8009}/visa-requirements`,
        {
          nationality: req.body.nationality,
          destination: req.body.destinationCountry || req.body.destination
        },
        { timeout: 30000 }
      );
      
      if (visaResponse.data && visaResponse.data.visaRequirements) {
        // Replace or enhance the visa information in LocalInfo
        if (typeof visaResponse.data.visaRequirements === 'object') {
          if (visaResponse.data.visaRequirements.content) {
            enhancedPlan.LocalInfo.Visa = visaResponse.data.visaRequirements.content;
          } else {
            // Format structured visa info
            const visa = visaResponse.data.visaRequirements;
            enhancedPlan.LocalInfo.Visa = `Type: ${visa.type}\nProcessing Time: ${visa.processingTime}\n` +
              `Required Documents: ${(visa.requiredDocuments || []).join(', ')}\n` +
              `Notes: ${visa.notes}`;
          }
        } else {
          enhancedPlan.LocalInfo.Visa = visaResponse.data.visaRequirements;
        }
        logger.info("[TripService] Successfully enhanced visa requirements");
      }
    } catch (visaError) {
      logger.error("[TripService] Failed to enhance visa requirements:", visaError.message);
      // Continue with original visa info if enhancement fails
    }

    // Step 5: Enhance cultural insights
    try {
      logger.info("[TripService] Step 5: Enhancing cultural insights");
      const cultureResponse = await axios.post(
        `http://localhost:${env.CULTURE_INSIGHTS_PORT || 8008}/cultural-insights`,
        {
          destination: req.body.destination,
          nationality: req.body.nationality
        },
        { timeout: 30000 }
      );
      
      if (cultureResponse.data && cultureResponse.data.culturalInsights) {
        // Replace or enhance the cultural information in LocalInfo
        enhancedPlan.LocalInfo.Customs = cultureResponse.data.culturalInsights;
        logger.info("[TripService] Successfully enhanced cultural insights");
      }
    } catch (cultureError) {
      logger.error("[TripService] Failed to enhance cultural insights:", cultureError.message);
      // Continue with original culture info if enhancement fails
    }

    logger.info("[TripService] Successfully enhanced trip plan with all available MCP services");

    try {
      const backendPayload = {
        user_id:
          req.body.user_id ||
          req.body.userCountry ||
          req.body.nationality ||
          "temp_user_id",
        destination: req.body.destination,
        destinationCountry: req.body.destinationCountry,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        displayDestination: req.body.displayDestination,
        year: req.body.year,
        month: req.body.month,
        travelerStyle: req.body.travelerStyle,
        budgetLevel: req.body.budgetLevel,
        duration: req.body.duration,
        nationality: req.body.nationality,
        interests: req.body.interests,
        tripPace: req.body.tripPace,
        specialRequirements: req.body.specialRequirements,
        transportationPreference: req.body.transportationPreference,
        itinerary: {
          status: "success",
          data: { content: enhancedPlan }
        }, // Use the enhanced plan
      };

      const backendRes = await axios.post(
        "http://localhost:5000/api/trips",
        backendPayload,
        { timeout: 15000 }
      );
      logger.info(`Trip stored in backend. Status: ${backendRes.status}`);
    } catch (storeErr) {
      logger.error(
        "[TripService] Failed to store trip in backend:",
        storeErr.message
      );
    }

    return res.json({
      status: "success",
      data: {
        content: enhancedPlan,
      },
    });
  } catch (error) {
    logger.error("[TripService] Generation error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to generate trip plan",
      error: error.message,
    });
  }
});

// Helper function to determine which day to add an event to
function determineDayForEvent(event, days) {
  // Simple implementation - just distribute events among days
  // A more sophisticated approach would check event date against trip dates
  const eventIndex = Math.floor(Math.random() * days.length);
  return eventIndex;
}

function buildTripPrompt(tripData) {
  const {
    destination,
    duration,
    interests,
    travelerStyle,
    nationality,
    specialRequirements,
  } = tripData;

  return `Create a detailed ${duration}-day travel itinerary for ${destination}.
  Traveler Profile:
  - Style: ${travelerStyle}
  - Nationality: ${nationality}
  - Interests: ${interests.join(", ")}
  - Special Requirements: ${specialRequirements.join(", ")}

  Please provide:
  1. Daily itinerary with activities
  2. Local customs and cultural considerations
  3. Visa requirements
  4. Weather information
  5. Transportation recommendations
  6. Estimated costs
  
  Format as a structured JSON response.`;
}

module.exports = router;
