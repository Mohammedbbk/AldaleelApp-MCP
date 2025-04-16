// Propose changes to AldaleelMCP/config/env.js

const dotenv = require('dotenv');

dotenv.config();

// Variables required by the gateway itself or configured microservices
const requiredEnvVars = [
  'OPENAI_API_KEY',     // Used by AI Itinerary Generator
  'SUPABASE_URL',       // Used by config.js (purpose unclear, maybe future use?)
  'SUPABASE_KEY',       // Used by config.js
  'MAPBOX_API_KEY',     // Used by Travel Planner MCP
  'TICKETMASTER_API_KEY', // Used by Live Events MCP
  'TRIPADVISOR_API_KEY',  // Used by TripAdvisor MCP
  'VISA_SERVICE_URL',   // ADDED: Full URL for the Visa microservice
  'CULTURE_SERVICE_URL', // ADDED: Full URL for the Culture microservice
  // Ports are needed if defaults are overridden, but let's not make them strictly required
  // 'AI_SERVER_PORT',
  // 'TRAVEL_PLANNER_PORT',
  // 'LIVE_EVENTS_PORT',
  // 'TRIPADVISOR_PORT',
  // 'AIRBNB_PORT' // Airbnb server is configured but doesn't need specific API keys here
];

const validateEnv = () => {
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingEnvVars.length > 0) {
    // Provide a more helpful error message for URL variables
    const detailedMissing = missingEnvVars.map(varName => {
        if (varName.endsWith('_URL')) {
            return `${varName} (e.g., [https://your-service-name.onrender.com](https://your-service-name.onrender.com) or http://internal-service-name:port)`;
        }
        return varName;
    });
    throw new Error(`Missing required environment variables: ${detailedMissing.join(', ')}`);
  }
};

validateEnv();

module.exports = {
  PORT: process.env.PORT || 8000,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  AI_SERVER_PORT: process.env.AI_SERVER_PORT,
  // DATA_SERVER_PORT is not used by any configured service
  // DATA_SERVER_PORT: process.env.DATA_SERVER_PORT,
  SUPABASE_URL: process.env.SUPABASE_URL, // Required by root config.js
  SUPABASE_KEY: process.env.SUPABASE_KEY, // Required by root config.js
  MAPBOX_API_KEY: process.env.MAPBOX_API_KEY, // Required by Travel Planner
  TRAVEL_PLANNER_PORT: process.env.TRAVEL_PLANNER_PORT,
  TICKETMASTER_API_KEY: process.env.TICKETMASTER_API_KEY,
  LIVE_EVENTS_PORT: process.env.LIVE_EVENTS_PORT,
  TRIPADVISOR_API_KEY: process.env.TRIPADVISOR_API_KEY,
  TRIPADVISOR_PORT: process.env.TRIPADVISOR_PORT || 8006,
  AIRBNB_PORT: process.env.AIRBNB_PORT || 8007, // Keep for potential local testing/other uses
  VISA_REQUIREMENTS_PORT: process.env.VISA_REQUIREMENTS_PORT || 8009, // Keep for potential local testing
  CULTURE_INSIGHTS_PORT: process.env.CULTURE_INSIGHTS_PORT || 8008, // Keep for potential local testing
  BRAVE_MCP_URL: process.env.BRAVE_MCP_URL, // Used by Visa and Culture services
  BRAVE_API_ENDPOINT: process.env.BRAVE_API_ENDPOINT, // Used by Visa and Culture services
  BRAVE_PORT: process.env.BRAVE_PORT, // Used by Visa and Culture services
  VISA_REQUEST_TIMEOUT: process.env.VISA_REQUEST_TIMEOUT,
  CULTURE_REQUEST_TIMEOUT: process.env.CULTURE_REQUEST_TIMEOUT,
  // BRAVE_API_KEY is not used by any configured service
  // BRAVE_API_KEY: process.env.BRAVE_API_KEY,

  // ADDED: Service URLs for deployed environments
  VISA_SERVICE_URL: process.env.VISA_SERVICE_URL,
  CULTURE_SERVICE_URL: process.env.CULTURE_SERVICE_URL,

  // BRAVE_PORT is not used by any configured service
  // BRAVE_PORT: process.env.BRAVE_PORT,
  WAIT_FOR_SERVERS: process.env.WAIT_FOR_SERVERS === 'true',
  NODE_ENV: process.env.NODE_ENV || 'development'
};
