// Propose changes to AldaleelMCP/config/env.js

const dotenv = require('dotenv');

dotenv.config();

// Base required environment variables for all environments
const baseRequiredEnvVars = [
  'OPENAI_API_KEY',      // Used by AI Itinerary Generator
  'SUPABASE_URL',        // Used by config.js
  'SUPABASE_KEY',        // Used by config.js
  'MAPBOX_API_KEY',      // Used by Travel Planner MCP
  'TICKETMASTER_API_KEY', // Used by Live Events MCP
  'TRIPADVISOR_API_KEY',  // Used by TripAdvisor MCP
];

// Additional variables required only in production
const productionEnvVars = [
  'VISA_SERVICE_URL',   // Required in production for the external Visa service
  'CULTURE_SERVICE_URL', // Required in production for the external Culture service
];

const validateEnv = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Always check the base required variables
  const missingBaseVars = baseRequiredEnvVars.filter(varName => !process.env[varName]);
  
  // In production, also check production-specific variables
  const missingProdVars = isProduction ? 
    productionEnvVars.filter(varName => !process.env[varName]) : 
    [];
  
  const allMissingVars = [...missingBaseVars, ...missingProdVars];
  
  if (allMissingVars.length > 0) {
    // Provide a more helpful error message
    const detailedMissing = allMissingVars.map(varName => {
      if (varName.endsWith('_URL')) {
        return `${varName} (e.g., https://your-service-name.onrender.com)`;
      }
      return varName;
    });
    throw new Error(`Missing required environment variables: ${detailedMissing.join(', ')}`);
  }
  
  // Log a warning for development about optional service URLs
  if (!isProduction) {
    if (!process.env.VISA_SERVICE_URL) {
      console.warn('[ENV WARNING] VISA_SERVICE_URL is not set. Proxy will use local visa service on port 8009. Set this variable for external services.');
    }
    if (!process.env.CULTURE_SERVICE_URL) {
      console.warn('[ENV WARNING] CULTURE_SERVICE_URL is not set. Proxy will use local culture service on port 8008. Set this variable for external services.');
    }
  }
};

validateEnv();

module.exports = {
  PORT: process.env.PORT || 8000,

  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  AI_SERVER_PORT: process.env.AI_SERVER_PORT || 8001,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  MAPBOX_API_KEY: process.env.MAPBOX_API_KEY,
  TRAVEL_PLANNER_PORT: process.env.TRAVEL_PLANNER_PORT || 8002,
  TICKETMASTER_API_KEY: process.env.TICKETMASTER_API_KEY,
  LIVE_EVENTS_PORT: process.env.LIVE_EVENTS_PORT || 8005,
  TRIPADVISOR_API_KEY: process.env.TRIPADVISOR_API_KEY,
  TRIPADVISOR_PORT: process.env.TRIPADVISOR_PORT || 8006,
  AIRBNB_PORT: process.env.AIRBNB_PORT || 8007,
  VISA_REQUIREMENTS_PORT: process.env.VISA_REQUIREMENTS_PORT || 8009, // Default local port
  CULTURE_INSIGHTS_PORT: process.env.CULTURE_INSIGHTS_PORT || 8008, // Default local port
  BRAVE_MCP_URL: process.env.BRAVE_MCP_URL,
  BRAVE_API_ENDPOINT: process.env.BRAVE_API_ENDPOINT,
  BRAVE_PORT: process.env.BRAVE_PORT || 3002,
  VISA_REQUEST_TIMEOUT: parseInt(process.env.VISA_REQUEST_TIMEOUT) || 30000,
  CULTURE_REQUEST_TIMEOUT: parseInt(process.env.CULTURE_REQUEST_TIMEOUT) || 30000,

  // Service URLs for deployed environments (REQUIRED in production)
  VISA_SERVICE_URL: process.env.VISA_SERVICE_URL, // e.g., https://aldaleel-visa-service.onrender.com
  CULTURE_SERVICE_URL: process.env.CULTURE_SERVICE_URL, // e.g., https://aldaleel-culture-service.onrender.com

  WAIT_FOR_SERVERS: process.env.WAIT_FOR_SERVERS === 'true',
  NODE_ENV: process.env.NODE_ENV || 'development'
};
