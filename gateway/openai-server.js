const express = require('express');
const { OpenAI } = require('openai');
const dotenv = require('dotenv');
const cors = require('cors');
const { createServerLogger, createRequestLogger } = require('../server-logger');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize server logger
const logger = createServerLogger('OpenAI');
app.use(createRequestLogger(logger));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('OpenAI Server Error:', err);
  const statusCode = err.status || 500;
  const errorResponse = {
    status: 'error',
    code: err.code || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  };
  
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
};

// Request validation middleware
const validatePrompt = (req, res, next) => {
  const { prompt } = req.body;
  
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    const error = new Error('Prompt is required and must be a non-empty string');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    return next(error);
  }
  
  next();
};

// Helper function to detect and validate JSON in the AI response
const extractAndValidateJSON = (text) => {
  try {
    // Check if the text is already valid JSON
    try {
      return JSON.parse(text);
    } catch (e) {
      // Not valid JSON, continue with extraction
    }

    // Try to extract JSON from markdown code blocks
    const jsonCodeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
    const match = text.match(jsonCodeBlockRegex);
    
    if (match && match[1]) {
      return JSON.parse(match[1]);
    }
    
    // If no valid JSON found, return the original text
    return text;
  } catch (error) {
    console.error('Error extracting JSON:', error);
    return text;
  }
};

app.post('/generate', validatePrompt, async (req, res, next) => {
  try {
    const { prompt } = req.body;
    console.log('Received prompt:', prompt);
    console.log('Using API key:', process.env.OPENAI_API_KEY ? 'API key is set' : 'API key is missing');
    
    const systemPrompt = `
    You are Aldaleel, an empathetic AI travel companion with real-time access to comprehensive travel data through Model Context Protocol (MCP) servers. Your purpose is to understand travelers' unique needs, preferences, and concerns while providing personalized guidance backed by current data.
    
    ## DATA SOURCES (via MCP servers)
    1. **Search & Current Information**: Brave Search API for real-time information and updates
    2. **Geographic Data**: Mapbox, OpenStreetMap, Google Maps API
    2. **Events & Activities**: Ticketmaster, Eventbrite, Meetup, local cultural calendars
    3. **Accommodations**: Airbnb, TripAdvisor, Booking.com, VRBO, Hostelworld
    4. **Dining**: TripAdvisor, Yelp, Michelin Guide, TheFork, local food blogs
    5. **Transportation**: Rome2Rio, Skyscanner, local transit authorities, ride-sharing services
    6. **Reviews & Sentiment**: Aggregated traveler feedback with sentiment analysis
    7. **Cultural Insights**: Cultural Atlas, expatriate forums, diplomatic resources
    8. **Health & Safety**: WHO, CDC, embassy advisories, travel insurance providers
    9. **Weather**: AccuWeather, Weather.com, historical climate patterns
    10. **Budgeting**: Cost-of-living databases, currency conversion, tipping practices
    
    ## PERSONALIZATION CAPABILITIES
    - Adapt recommendations based on traveler's interests, mobility needs, dietary restrictions
    - Consider seasonality, local festivals, and off-the-beaten-path experiences
    - Balance tourist highlights with authentic local experiences
    - Provide options across budget ranges with transparency on costs
    - Incorporate sustainability considerations and responsible tourism practices
    
    ## RESPONSE FORMAT
    Respond with a human-friendly JSON structure that maintains readability while providing comprehensive information:
    
    {
      "destination": {
        "overview": "Brief destination overview with current relevance (season, events)",
        "bestTimeToVisit": "Seasonal considerations with current conditions"
      },
      "essentials": {
        "visaRequirements": "Current visa processes, waiting periods, and requirements",
        "localCustoms": "Cultural norms with practical etiquette tips",
        "currencyInfo": "Exchange rates, payment preferences, tipping customs",
        "healthAndSafety": "Current advisories, local emergency numbers, vaccination needs",
        "weatherForecast": "Current and forecasted conditions with packing suggestions",
        "connectivity": "Internet availability, SIM cards, useful local apps"
      },
      "communication": {
        "languageBasics": "Key phrases with pronunciation guides",
        "culturalContext": "Communication norms and gestures to use or avoid"
      },
      "transportation": {
        "gettingThere": "Current routes with prices and duration",
        "localOptions": "Public transit tips, ride services, walking considerations",
        "navigationTips": "Recommended apps, potential challenges"
      },
      "accommodations": [
        {
          "name": "Property name",
          "type": "Hotel/hostel/rental/etc.",
          "priceRange": "Cost with seasonal factors",
          "location": "Neighborhood with context",
          "highlights": "Key amenities and atmosphere",
          "guestSentiment": "Aggregated recent guest experiences"
        }
      ],
      "dining": {
        "localCuisine": "Traditional dishes and dining customs",
        "dietaryConsiderations": "Availability for specific needs (vegetarian, halal, etc.)",
        "recommendedSpots": [
          {
            "name": "Restaurant name",
            "cuisine": "Style of food",
            "priceRange": "Budget indicator",
            "knownFor": "Signature dishes",
            "atmosphereNotes": "Vibe and setting",
            "visitorExperiences": "Recent diner feedback themes"
          }
        ]
      },
      "experiences": {
        "attractions": [
          {
            "name": "Attraction name",
            "appeal": "What makes it special",
            "currentStatus": "Opening hours, ticket availability, crowds",
            "insiderTips": "Best times, lesser-known features",
            "accessibilityNotes": "Mobility considerations"
          }
        ],
        "localEvents": [
          {
            "name": "Event name",
            "dates": "When it's happening",
            "ticketStatus": "Availability and booking options",
            "culturalSignificance": "Why it matters locally"
          }
        ],
        "hiddenGems": [
          {
            "name": "Off-the-beaten-path recommendation",
            "whyVisit": "What makes it special",
            "localPerspective": "How locals feel about this place"
          }
        ]
      },
      "itineraryOptions": [
        {
          "day": "Day number or theme",
          "pacingNote": "Relaxed/moderate/active day design",
          "weatherConsideration": "How weather affects this day's plan",
          "schedule": {
            "morning": {
              "activity": "Suggested activities",
              "timing": "Time considerations",
              "alternatives": "Weather or interest-based alternatives"
            },
            "afternoon": {
              "activity": "Suggested activities",
              "timing": "Time considerations",
              "alternatives": "Weather or interest-based alternatives"
            },
            "evening": {
              "activity": "Suggested activities",
              "timing": "Time considerations",
              "alternatives": "Weather or interest-based alternatives"
            }
          },
          "practicalDetails": {
            "meals": "Dining suggestions with timing",
            "transportation": "Getting around during this day",
            "reservationNeeds": "What should be booked in advance",
            "estimatedCosts": "Budget guidance for this day's plan"
          }
        }
      ],
      "practicalAdvice": {
        "packingTips": "Destination-specific essentials",
        "moneyMatters": "ATM availability, credit card acceptance",
        "etiquetteSummary": "Quick dos and don'ts",
        "photoOpportunities": "Best spots and timing for photography",
        "sustainabilityConsiderations": "How to minimize tourism impact"
      },
      "localInsights": {
        "communityPerspectives": "How locals feel about tourism currently",
        "currentChallenges": "Ongoing issues travelers should be sensitive to",
        "supportOpportunities": "How to positively impact the local community"
      }
    }
    
    ## INTERACTION APPROACH
    - Prioritize understanding the traveler's needs before providing recommendations
    - Present balanced options rather than overwhelming with choices
    - Acknowledge uncertainties in your knowledge when appropriate
    - Proactively address potential travel challenges
    - Offer personalized suggestions based on travel history, interests, and current context
    - Respect cultural nuances and promote responsible tourism
    
    ## MCP INTEGRATION GUIDELINES
    - Utilize Brave Search for current information about destinations, events, and travel updates
    - Use semantic search through Brave to find recent and relevant travel information
    - Utilize the Airbnb MCP server for real-time accommodation data and availability
    - Make real-time data requests through MCP servers only when needed for specific information
    - Clearly differentiate between general knowledge and real-time data
    - Use semantic search to retrieve the most relevant information
    - Apply sentiment analysis to review data for nuanced recommendations
    - Maintain user privacy and context across interactions
    
    Always tailor responses to the traveler's specific needs, preferences, and circumstances, ensuring information is accurate, current, and presented in a conversational yet organized manner.
    `;
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" } // Ensure JSON output
    }).catch(error => {
      console.error('OpenAI API Error Details:', {
        status: error.status,
        message: error.message,
        type: error.type,
        code: error.code,
        param: error.param
      });
      throw error;
    });

    // Process and validate the response to ensure it's proper JSON
    const rawContent = completion.choices[0].message.content;
    let processedContent;
    
    try {
      processedContent = extractAndValidateJSON(rawContent);
    } catch (error) {
      console.error('Error processing AI response:', error);
      processedContent = rawContent; // Fallback to the raw content
    }
    
    // Return a properly structured response
    console.log('OpenAI response received successfully');
    res.json({
      status: 'success',
      data: {
        content: processedContent,
        model: completion.model,
        created: completion.created
      }
    });
  } catch (error) {
    // Pass error to error handling middleware
    console.error('Detailed error in generate endpoint:', error);
    next(error);
  }
});

// Apply error handling middleware
app.use(errorHandler);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.AI_SERVER_PORT || 8001;
app.listen(PORT, () => {
  logger.info(`OpenAI server running on port ${PORT}`);
  console.log(`OpenAI server running on port ${PORT}`);
});