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

    // Add actual calendar dates to each day of the plan
    if (enhancedPlan && enhancedPlan.Days && Array.isArray(enhancedPlan.Days)) {
      const tripYear = parseInt(req.body.year);
      
      // Convert month string (e.g., "Jan", "Feb", "Dec") to 0-indexed month number
      const monthStr = req.body.month;
      let tripMonthNumber = -1; // 0-indexed month
      if (monthStr) {
        const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        tripMonthNumber = monthNames.indexOf(monthStr.toLowerCase().substring(0, 3));
      }

      if (tripYear && tripMonthNumber !== -1 && !isNaN(tripYear)) {
        // Base date for the start of the trip
        const tripStartDateObj = new Date(Date.UTC(tripYear, tripMonthNumber, 1)); // Use 0-indexed tripMonthNumber

        if (isNaN(tripStartDateObj.getTime())) {
          logger.error(`[TripService] Failed to create a valid tripStartDateObj. Year: ${tripYear}, MonthStr: ${monthStr}, ParsedMonthNumber: ${tripMonthNumber}`);
        } else {
          enhancedPlan.Days.forEach((day, index) => {
            const currentDayDate = new Date(tripStartDateObj);
            currentDayDate.setUTCDate(tripStartDateObj.getUTCDate() + index); // index is 0-based, so day 1 is index 0
            if (isNaN(currentDayDate.getTime())) {
              logger.error(`[TripService] currentDayDate became invalid for day index ${index}. Base Start: ${tripStartDateObj.toISOString()}`);
              day.calendarDate = 'Invalid Date'; // Assign a placeholder if still invalid
            } else {
              day.calendarDate = currentDayDate.toISOString().split('T')[0]; // "YYYY-MM-DD"
            }
          });
          logger.info("[TripService] Added calendar dates to itinerary days");
        }
      } else {
        logger.error(`[TripService] Invalid year or month for adding calendar dates. Year: ${req.body.year}, Month: ${req.body.month}`);
        // Optionally, you could assign a default/error value to all day.calendarDate if this path is taken
        enhancedPlan.Days.forEach(day => day.calendarDate = 'Date Not Set');
      }
    }

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

      const year = parseInt(req.body.year);
      let monthNumber; // 0-indexed month
      const monthStr = req.body.month;
      if (monthStr) {
        const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        monthNumber = monthNames.indexOf(monthStr.toLowerCase().substring(0, 3));
      }

      if (isNaN(year) || monthNumber === undefined || monthNumber === -1) {
        logger.error(`[TripService] Invalid year or month for fetching events. Year: ${req.body.year}, Month: ${req.body.month}`);
        throw new Error("Invalid year or month provided for events.");
      }
      
      const durationDays = parseInt(req.body.duration) || 7;

      // Create start date as the first day of the given month and year (UTC)
      const startDateObj = new Date(Date.UTC(year, monthNumber, 1)); // Use 0-indexed monthNumber

      // Create end date for the duration (UTC)
      // If duration is 7 days, and startDate is Day 1, endDate should be Day 7.
      const endDateObj = new Date(Date.UTC(year, monthNumber, 1));
      endDateObj.setUTCDate(startDateObj.getUTCDate() + durationDays - 1);

      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        logger.error(`[TripService] Failed to create valid start or end dates for events. Year: ${year}, MonthStr: ${monthStr}, ParsedMonthNumber: ${monthNumber}`);
        throw new Error("Failed to construct valid dates for events query.");
      }

      const formattedStartDate = startDateObj.toISOString().split('T')[0]; // "YYYY-MM-DD"
      const formattedEndDate = endDateObj.toISOString().split('T')[0];   // "YYYY-MM-DD"

      const eventsPayload = {
        destination: req.body.destination,
        startDate: formattedStartDate,
        endDate: formattedEndDate,
      };

      logger.info("[TripService] Attempting to call /events endpoint with payload:", JSON.stringify(eventsPayload));

      const eventsResponse = await axios.post(
        `http://localhost:${env.LIVE_EVENTS_PORT || 8005}/events`,
        eventsPayload,
        { timeout: 30000 }
      );
      
      if (eventsResponse.data && eventsResponse.data.events) {
        // Add events to the appropriate days in the itinerary
        eventsResponse.data.events.forEach(event => {
          const dayIndex = determineDayForEvent(event, enhancedPlan.Days);
          if (dayIndex >= 0 && dayIndex < enhancedPlan.Days.length) {
            if (!enhancedPlan.Days[dayIndex].Notes) {
              enhancedPlan.Days[dayIndex].Notes = [];
            }
            enhancedPlan.Days[dayIndex].Notes.push(`Event: ${event.name} at ${event.venue}. Time: ${event.time}`);
          }
        });
        logger.info("[TripService] Successfully added local events");
      }
    } catch (eventsError) {
      let errorDetails = eventsError.message;
      if (eventsError.response) {
        // Axios error with a response from the server
        errorDetails = `Status: ${eventsError.response.status}, Data: ${JSON.stringify(eventsError.response.data)}, Message: ${eventsError.message}`;
      } else if (eventsError.request) {
        // Axios error where the request was made but no response was received
        errorDetails = `No response received. Request details: ${JSON.stringify(eventsError.request)}. Message: ${eventsError.message}`;
      } else {
        // Non-Axios error or setup issue
        errorDetails = eventsError.message || 'Unknown error object';
      }
      logger.error("[TripService] Failed to add local events:", errorDetails, eventsError.stack ? `\nStack: ${eventsError.stack}` : '');
      logger.error("[TripService] Full eventsError object:", JSON.stringify(eventsError, Object.getOwnPropertyNames(eventsError)));
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
        }, 
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
  if (!event || !event.date || !days || !Array.isArray(days)) {
    logger.warn("[TripService determineDayForEvent] Invalid input for event or days array.");
    return -1;
  }

  // event.date is expected to be "YYYY-MM-DD" from live-events-server
  const eventDateStr = event.date;

  for (let i = 0; i < days.length; i++) {
    if (days[i].calendarDate === eventDateStr) {
      logger.info(`[TripService determineDayForEvent] Matched event ${event.name} on ${eventDateStr} to Day ${i + 1}`);
      return i; // Return 0-based index
    }
  }

  logger.warn(`[TripService determineDayForEvent] Event ${event.name} on ${eventDateStr} does not match any trip day dates.`);
  // Optional: Could try to match based on proximity or log for later review
  return -1; // Event date doesn't match any day in the itinerary
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
  1. Daily itinerary with activities (morning, afternoon, evening), including brief descriptions and any estimated costs for activities if applicable.
  2. Local customs and cultural considerations (etiquette, social norms, communication tips, key phrases, important notes).
  3. Visa requirements based on ${nationality} nationality for ${destination}.
  4. Weather information typical for the destination during the planned travel time.
  5. Transportation recommendations (getting around, public transport, taxis, ride-sharing).
  6. Health and Safety guidelines (including any necessary vaccinations, local health precautions, and emergency contact information like police, ambulance, embassy if generally available for tourists).
  7. Estimated overall trip costs (e.g., budget, mid-range, luxury) or a breakdown if possible.
  
  Format as a structured JSON response. Ensure the JSON is well-formed. The main keys should be "TripInfo", "Days" (an array of day objects), and "LocalInfo".
  Under "LocalInfo", include sub-keys like "Customs", "Visa", "Weather", "Transport", "Health", and "Costs".
  Each day in "Days" should have "DayNumber", "Activities" (with "Morning", "Afternoon", "Evening" sub-objects), "DailyCost", "Transport", and "Notes".`;
}

module.exports = router;
