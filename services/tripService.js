const express = require("express");
const router = express.Router();
const { createServerLogger } = require("../server-logger");
const axios = require("axios");
const env = require("../config/env");

const logger = createServerLogger("TripService");

// Set service-specific timeout
const serviceTimeout = parseInt(process.env.CULTURE_REQUEST_TIMEOUT) || 30000;

// Increase timeout for long-running AI operations
const AI_REQUEST_TIMEOUT = 120000; // 2 minutes

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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filter = req.query.filter || "all";
    const sort = req.query.sort || "date";
    const search = req.query.search || "";

    // Mock data
    const trips = [
      {
        id: 1,
        destination: "Paris",
        startDate: "2024-06-01",
        endDate: "2024-06-07",
        status: "upcoming",
        userCountry: "USA",
      },
      {
        id: 2,
        destination: "Tokyo",
        startDate: "2024-07-01",
        endDate: "2024-07-14",
        status: "upcoming",
        userCountry: "UK",
      },
    ];

    // Set response headers
    res.set({
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });

    return res.status(200).json({
      status: "success",
      data: {
        trips: trips,
      },
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(trips.length / limit),
        totalItems: trips.length,
      },
    });
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
  // Increase server timeout
  req.setTimeout(120000);

  try {
    logger.info("[TripService] Received generation request:", req.body);

    // Set headers to maintain connection
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Keep-Alive", "timeout=120");

    // Call OpenAI server
    const response = await axios.post(
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

    logger.info("[TripService] Successfully generated content");

    // ---------------------------------------------------------------
    // Store the generated trip in the Backend (Supabase)
    // ---------------------------------------------------------------
    try {
      // Compose payload combining the original request and AI itinerary
      const backendPayload = {
        user_id: req.body.user_id || req.body.userCountry || req.body.nationality || "temp_user_id",
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
        itinerary: response.data, // the AI generated content
      };

      const backendRes = await axios.post("http://localhost:5000/api/trips", backendPayload, { timeout: 15000 });
      logger.info(`Trip stored in backend. Status: ${backendRes.status}`);
    } catch (storeErr) {
      logger.error("[TripService] Failed to store trip in backend:", storeErr.message);
    }
    // ---------------------------------------------------------------

    return res.json({
      status: "success",
      data: {
        content: response.data,
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
