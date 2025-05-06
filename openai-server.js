const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const dotenv = require("dotenv");
const { createServerLogger } = require("./server-logger");
const env = require("./config/env");

dotenv.config({ override: true });

const app = express();
const logger = createServerLogger("OpenAI");
const PORT = process.env.AI_SERVER_PORT || 8001;

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
  
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Accept"],
    credentials: true,
  })
);
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
    const systemPromptContent = `You are an expert AI travel planner assistant. Your primary goal is to generate a comprehensive and structured travel plan by calling the 'generate_travel_plan' function.
    Carefully analyze the user's request provided in the user message to extract key details such as:
    - Destination (City, Country)
    - Duration of the trip
    - Travel Style (e.g., Solo, Family, Couple, Budget, Luxury)
    - Traveler's Nationality (important for Visa info)
    - Specific Requirements or Interests (e.g., Halal food, museums, hiking, accessibility needs)
    - Any mentioned budget constraints or preferences.

    Use the extracted information to meticulously populate ALL the required fields and relevant optional fields within the 'generate_travel_plan' function's arguments schema.

    Instructions for populating the schema:
    - TripInfo: Fill in the overall trip details accurately based on the user request. Infer 'Title' if not provided. Estimate 'TotalCost' based on duration, destination, style, and daily costs. Include 'Requirements' if mentioned.
    - Days: Create a logical day-by-day plan for the specified 'Duration'.
        - For each Day: Assign a 'DayNumber'.
        - Activities (Morning, Afternoon, Evening): Suggest relevant activities based on user interests and destination. Provide a concise 'Description' for each. Estimate a plausible 'Cost' for activities where applicable (use local currency or USD and specify). Ensure activities flow logically.
        - Transport: Suggest appropriate transport methods for the day's activities (e.g., 'Metro', 'Taxi', 'Rental Car', 'Walking').
        - DailyCost: Provide a rough estimate for the day's expenses (excluding accommodation, unless specified otherwise).
    - LocalInfo: Provide practical and concise information relevant to the 'Destination' and 'Nationality':
        - Customs: Mention key social customs or etiquette.
        - Weather: Briefly describe typical weather for the travel period (if inferable).
        - Transport: General advice on local public/private transport options.
        - Health: Mention any standard health precautions or recommendations (e.g., vaccinations, water safety).
        - Visa: Provide general visa information based on the traveler's 'Nationality' and 'Destination'. **Crucially, advise the user to verify requirements with official embassy/consulate sources.**

    Ensure the generated JSON object strictly adheres to the provided function schema structure and types. Provide realistic and helpful information throughout.`;

    logger.info("Generating itinerary with prompt:", prompt);

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content:
            systemPromptContent,
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

    res.json({
      status: "success",
      data: {
        content: parsedContent, 
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

initializeOpenAI();
app.listen(PORT, () => {
  logger.info(`OpenAI server listening on port ${PORT}`);
});
