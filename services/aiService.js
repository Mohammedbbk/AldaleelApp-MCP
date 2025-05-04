const { z } = require("zod");
const OpenAI = require("openai");
const { createServerLogger } = require("../server-logger");

const logger = createServerLogger("AIService");

// Define the function schema for OpenAI
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

class TravelPlanService {
  // Get the schema for external use
  static getFunctionSchema() {
    return functionSchema;
  }

  async generateItinerary({
    destination,
    duration,
    nationality,
    requirements,
  }) {
    try {
      const openai = new OpenAI();

      logger.info("Generating itinerary with parameters:", {
        destination,
        duration,
        nationality,
        requirements,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content:
              "You are a travel planner that generates detailed itineraries in a structured format.",
          },
          {
            role: "user",
            content: `Create a ${duration}-day travel plan for ${destination}. 
                     Traveler Profile:
                     - Nationality: ${nationality}
                     - Special Requirements: ${requirements.join(", ")}
                     
                     Include detailed daily activities with descriptions and costs.`,
          },
        ],
        functions: [functionSchema],
        function_call: { name: "generate_travel_plan" },
      });

      const content = response.choices[0]?.message?.function_call?.arguments;
      if (!content) throw new Error("No content generated");

      return JSON.parse(content);
    } catch (error) {
      logger.error("Error generating travel plan:", error);
      throw error;
    }
  }
}

// Export both the service instance and schema access method
module.exports = {
  travelPlanService: new TravelPlanService(),
  getFunctionSchema: TravelPlanService.getFunctionSchema,
};
