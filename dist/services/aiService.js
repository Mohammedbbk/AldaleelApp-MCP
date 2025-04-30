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
const axios = require('axios');
const { createServerLogger } = require('../server-logger');
const env = require('../config/env');
const logger = createServerLogger('AIService');
// Log whether the OpenAI API key is loaded
logger.info('[AIService] OpenAI Key Loaded:', env.OPENAI_API_KEY ? 'Yes' : 'No');
class AIService {
    generateItinerary(_a) {
        return __awaiter(this, arguments, void 0, function* ({ destination, days, budget, interests = [], userCountry = '', travelDates = '', travelStyle = '', dietaryRestrictions = [] }) {
            var _b;
            try {
                const prompt = this.buildPrompt({
                    destination,
                    days,
                    budget,
                    interests,
                    userCountry,
                    travelDates,
                    travelStyle,
                    dietaryRestrictions
                });
                // Log the prompt before sending to AI server
                logger.info('[AIService] Built prompt:', prompt);
                logger.info(`Sending request to AI server at http://127.0.0.1:${env.AI_SERVER_PORT}/generate`);
                const response = yield axios.post(`http://127.0.0.1:${env.AI_SERVER_PORT}/generate`, {
                    prompt
                });
                // Log the raw response data from AI server
                logger.info('[AIService] Raw AI server response:', JSON.stringify(response.data, null, 2));
                return this.parseItineraryResponse(response.data);
            }
            catch (error) {
                logger.error('Error generating itinerary:', error);
                // Log the error response data if available
                logger.error('[AIService] Error response data:', (_b = error.response) === null || _b === void 0 ? void 0 : _b.data);
                throw error;
            }
        });
    }
    buildPrompt({ destination, days, budget, interests, userCountry, travelDates, travelStyle, dietaryRestrictions }) {
        // Format budget: prefix $ if numeric, otherwise use text value
        const budgetText = typeof budget === 'number' ? `$${budget}` : budget;
        return `Create a detailed ${days}-day travel itinerary for ${destination} with a budget of ${budgetText}.
      ${interests.length > 0 ? `Focus on these interests: ${interests.join(', ')}.` : ''}
      ${userCountry ? `The traveler is from ${userCountry}.` : ''}
      ${travelDates ? `Travel dates: ${travelDates}.` : ''}
      ${travelStyle ? `Travel style preference: ${travelStyle}.` : ''}
      ${dietaryRestrictions.length > 0 ? `Dietary restrictions: ${dietaryRestrictions.join(', ')}.` : ''}
      
      Format your response as a structured JSON with the following sections:
      1. "visaRequirements": Detailed visa information for someone from ${userCountry || 'the traveler\'s country'} visiting ${destination}, including application process, fees, and requirements
      2. "localCustoms": Important cultural norms, etiquette, dress codes, and behaviors to be aware of
      3. "currencyInfo": Currency details, exchange rates, tipping customs, payment methods accepted
      4. "healthAndSafety": Vaccinations needed, health precautions, emergency numbers, safety tips
      5. "transportation": How to get around, public transit options, recommended transportation methods
      6. "languageBasics": Official language, common useful phrases, communication tips
      7. "weatherInfo": Seasonal weather patterns, what to expect during the travel period
      8. "dailyItinerary": Array of daily plans, each with morning, afternoon, and evening activities, including:
         - timing
         - activities
         - estimatedCosts
         - transportationOptions
         - accommodationSuggestions
         - mealRecommendations
      
      Make sure all the information is accurate, practical, and tailored to the traveler's specifics.`;
    }
    parseItineraryResponse(response) {
        var _a;
        try {
            const content = response.data.content;
            const parsed = typeof content === 'string' ? JSON.parse(content) : content;
            // If parsed is an object and has at least one expected key, return as is
            if (parsed && (parsed.places || parsed.tips || parsed.culturalNotes || parsed.safetyTips || parsed.additionalInfo)) {
                return parsed;
            }
            // Fallback: wrap as additionalInfo
            return { additionalInfo: typeof content === 'string' ? content : JSON.stringify(content) };
        }
        catch (error) {
            logger.error('Error parsing itinerary as JSON:', error);
            const rawContent = ((_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.content) || '';
            return {
                additionalInfo: rawContent,
                parsingError: "The AI response couldn't be parsed as JSON."
            };
        }
    }
}
module.exports = new AIService();
