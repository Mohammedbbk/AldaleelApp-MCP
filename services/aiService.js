const { z } = require("zod");
const axios = require("axios");
const { createServerLogger } = require("../server-logger");

const logger = createServerLogger("AIService");

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
      logger.info("Generating enhanced itinerary with MCP servers:", {
        destination,
        duration,
        nationality,
        requirements,
      });

      const baseItinerary = await this.getBaseItinerary({
        destination, duration, nationality, requirements
      });

      const enhancedWithLocationData = await this.enhanceWithLocationData(
        baseItinerary, destination
      );

      const withEvents = await this.addLocalEvents(
        enhancedWithLocationData, destination, duration
      );

      const withVisaInfo = await this.addVisaRequirements(
        withEvents, destination, nationality
      );

      const finalPlan = await this.addCulturalInsights(
        withVisaInfo, destination
      );

      return finalPlan;
    } catch (error) {
      logger.error("Error generating enhanced travel plan:", error);
      throw error;
    }
  }

  async getBaseItinerary({ destination, duration, nationality, requirements }) {
    try {
      const response = await axios.post('http://localhost:8001/generate-itinerary', {
        destination,
        duration,
        nationality,
        requirements
      });
      return response.data;
    } catch (error) {
      logger.error("Error getting base itinerary from AI server:", error);
      throw error;
    }
  }

  async enhanceWithLocationData(itinerary, destination) {
    try {
      const response = await axios.post('http://localhost:8002/enhance-locations', {
        itinerary,
        destination
      });
      return response.data;
    } catch (error) {
      logger.error("Error enhancing with location data:", error);
      return itinerary;
    }
  }

  async addLocalEvents(itinerary, destination, duration) {
    try {
      const response = await axios.post('http://localhost:8005/find-events', {
        itinerary,
        destination,
        duration
      });
      return response.data;
    } catch (error) {
      logger.error("Error adding local events:", error);
      return itinerary;
    }
  }

  async addVisaRequirements(itinerary, destination, nationality) {
    try {
      const response = await axios.post('http://localhost:8009/visa-requirements', {
        destination,
        nationality
      });
      
      if (response.data && response.data.visaInfo) {
        itinerary.LocalInfo.Visa = response.data.visaInfo;
      }
      
      return itinerary;
    } catch (error) {
      logger.error("Error adding visa requirements:", error);
      return itinerary;
    }
  }

  async addCulturalInsights(itinerary, destination) {
    try {
      const response = await axios.post('http://localhost:8008/cultural-insights', {
        destination
      });
      
      if (response.data && response.data.culturalInsights) {
        itinerary.LocalInfo.Customs = response.data.culturalInsights;
      }
      
      return itinerary;
    } catch (error) {
      logger.error("Error adding cultural insights:", error);
      return itinerary;
    }
  }
}

module.exports = {
  travelPlanService: new TravelPlanService(),
  getFunctionSchema: TravelPlanService.getFunctionSchema,
};
