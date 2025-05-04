const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const dotenv = require("dotenv");
const { createServerLogger } = require("./server-logger");
const env = require("./config/env");

// Force reload environment variables
dotenv.config({ override: true });

const app = express();
const logger = createServerLogger("OpenAI");
const PORT = process.env.AI_SERVER_PORT || 8001;

// Define the function schema inline to ensure it's available
const functionSchema = {
  name: "generate_travel_plan",
  description: "Generate a structured travel plan",
  parameters: {
    type: "object",
    required: ["TripInfo", "Days", "LocalInfo"],
    properties: {
      TripInfo: {
        type: "object",
        required: [
          "Title",
          "Destination",
          "Duration",
          "TotalCost",
          "Style",
          "Nationality",
        ],
        properties: {
          Title: { type: "string", description: "Title of the trip" },
          Destination: {
            type: "string",
            description: "Destination city and country",
          },
          Duration: { type: "string", description: "Duration of the trip" },
          TotalCost: { type: "string", description: "Estimated total cost" },
          Style: {
            type: "string",
            description: "Travel style (Solo, Family, etc)",
          },
          Nationality: {
            type: "string",
            description: "Traveler's nationality",
          },
          Requirements: {
            type: "array",
            items: { type: "string" },
            description: "Special requirements like Halal food",
          },
        },
      },
      Days: {
        type: "array",
        items: {
          type: "object",
          required: ["DayNumber", "Activities", "Transport", "DailyCost"],
          properties: {
            DayNumber: { type: "number" },
            Activities: {
              type: "object",
              required: ["Morning", "Afternoon", "Evening"],
              properties: {
                Morning: {
                  type: "object",
                  required: ["Activity", "Description"],
                  properties: {
                    Activity: { type: "string" },
                    Description: { type: "string" },
                    Cost: { type: "string" },
                  },
                },
                Afternoon: {
                  type: "object",
                  required: ["Activity", "Description"],
                  properties: {
                    Activity: { type: "string" },
                    Description: { type: "string" },
                    Cost: { type: "string" },
                  },
                },
                Evening: {
                  type: "object",
                  required: ["Activity", "Description"],
                  properties: {
                    Activity: { type: "string" },
                    Description: { type: "string" },
                    Cost: { type: "string" },
                  },
                },
              },
            },
            Transport: { type: "string" },
            DailyCost: { type: "string" },
          },
        },
      },
      LocalInfo: {
        type: "object",
        required: ["Customs", "Weather", "Transport", "Health", "Visa"],
        properties: {
          Customs: { type: "string" },
          Weather: { type: "string" },
          Transport: { type: "string" },
          Health: { type: "string" },
          Visa: { type: "string" },
        },
      },
    },
  },
};

// Middleware
app.use(cors());
app.use(express.json());

let openai;

function initializeOpenAI() {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || env.OPENAI_API_KEY,
  });
  logger.info("OpenAI client initialized successfully");
}

app.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({
        status: "error",
        message: "Prompt is required",
      });
    }

    logger.info("Generating itinerary with prompt:", prompt);

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content:
            "You are a travel planner that generates detailed itineraries in a structured format.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      functions: [functionSchema],
      function_call: { name: "generate_travel_plan" },
    });

    const functionCallArgs =
      completion.choices[0]?.message?.function_call?.arguments;

    if (!functionCallArgs) {
      throw new Error("No content generated");
    }

    let parsedContent;
    try {
      parsedContent =
        typeof functionCallArgs === "string"
          ? JSON.parse(functionCallArgs)
          : functionCallArgs;
    } catch (parseError) {
      logger.error("Failed to parse OpenAI response:", parseError);
      throw new Error("Invalid response format from AI");
    }

    // Send the response
    res.json({
      status: "success",
      data: {
        content: parsedContent, // Already an object, no need to stringify
      },
    });
  } catch (error) {
    logger.error("[OpenAI] Error generating itinerary:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to generate itinerary",
      errorDetails: {
        type: error.type || "PARSING_ERROR",
        code: error.code || "INVALID_RESPONSE",
        message: error.message,
      },
    });
  }
});

// Initialize OpenAI and start server
initializeOpenAI();
app.listen(PORT, () => {
  logger.info(`OpenAI server listening on port ${PORT}`);
});
