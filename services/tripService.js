const express = require("express");
const router = express.Router();
const { createServerLogger } = require("../server-logger");
const axios = require("axios");
const env = require("../config/env");

const logger = createServerLogger("TripService");

// Set service-specific timeout
const serviceTimeout = parseInt(process.env.CULTURE_REQUEST_TIMEOUT) || 30000;

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
  try {
    logger.info("[TripService] Received generation request:", req.body);

    // Call OpenAI server
    const response = await axios.post(
      `http://localhost:${env.AI_SERVER_PORT}/generate`,
      {
        prompt: buildTripPrompt(req.body),
      }
    );

    logger.info("[TripService] Successfully generated content");

    return res.json({
      status: "success",
      data: response.data,
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
