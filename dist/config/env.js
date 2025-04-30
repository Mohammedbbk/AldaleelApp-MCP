"use strict";
// Propose changes to AldaleelMCP/config/env.js
const dotenv = require('dotenv');
dotenv.config();
// Base required environment variables for all environments
const baseRequiredEnvVars = [
    'OPENAI_API_KEY', // Used by AI Itinerary Generator
    'SUPABASE_URL', // Used by config.js
    'SUPABASE_KEY', // Used by config.js
    'MAPBOX_API_KEY', // Used by Travel Planner MCP
    'TICKETMASTER_API_KEY', // Used by Live Events MCP
    'TRIPADVISOR_API_KEY', // Used by TripAdvisor MCP
];
// VISA_SERVICE_URL and CULTURE_SERVICE_URL are optional.
// The proxyController defaults to localhost if they aren't set,
// which is correct for single-service deployments.
const validateEnv = () => {
    // Always check the base required variables
    const missingBaseVars = baseRequiredEnvVars.filter(varName => !process.env[varName]);
    // Only check base variables now
    const allMissingVars = [...missingBaseVars];
    if (allMissingVars.length > 0) {
        // Provide a more helpful error message
        const detailedMissing = allMissingVars.map(varName => {
            // Keep URL formatting hint just in case user adds them later for separate deployment
            if (varName.endsWith('_URL')) {
                return `${varName} (e.g., https://your-service-name.onrender.com)`;
            }
            return varName;
        });
        throw new Error(`Missing required environment variables: ${detailedMissing.join(', ')}`);
    }
    // Log a warning if the optional service URLs are not set (useful for awareness)
    // These warnings are expected in the single-service deployment
    if (!process.env.VISA_SERVICE_URL) {
        console.warn('[ENV WARNING] VISA_SERVICE_URL is not set. Proxy will default to internal service (localhost:8009). This is expected for single-service deployments.');
    }
    if (!process.env.CULTURE_SERVICE_URL) {
        console.warn('[ENV WARNING] CULTURE_SERVICE_URL is not set. Proxy will default to internal service (localhost:8008). This is expected for single-service deployments.');
    }
};
validateEnv();
// Assign the new port, defaulting to 8010
const braveLLMPort = process.env.BRAVE_LLM_PORT || 8010;
module.exports = {
    PORT: process.env.PORT || 8000,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AI_SERVER_PORT: process.env.AI_SERVER_PORT || 8001,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    MAPBOX_API_KEY: process.env.MAPBOX_API_KEY,
    TRAVEL_PLANNER_PORT: process.env.TRAVEL_PLANNER_PORT || 8004,
    TICKETMASTER_API_KEY: process.env.TICKETMASTER_API_KEY,
    LIVE_EVENTS_PORT: process.env.LIVE_EVENTS_PORT || 8005,
    TRIPADVISOR_API_KEY: process.env.TRIPADVISOR_API_KEY,
    TRIPADVISOR_PORT: process.env.TRIPADVISOR_PORT || 8006,
    AIRBNB_PORT: process.env.AIRBNB_PORT || 8007,
    VISA_REQUIREMENTS_PORT: process.env.VISA_REQUIREMENTS_PORT || 8009, // Default local port
    CULTURE_INSIGHTS_PORT: process.env.CULTURE_INSIGHTS_PORT || 8008, // Default local port
    // Brave LLM Configuration
    BRAVE_LLM_PORT: braveLLMPort, // Export the new port
    // Construct the URL using the determined port. Use 127.0.0.1 for clarity in local/container comms.
    BRAVE_MCP_URL: process.env.BRAVE_MCP_URL || `http://127.0.0.1:${braveLLMPort}`,
    BRAVE_API_ENDPOINT: process.env.BRAVE_API_ENDPOINT || '/api/chat',
    // BRAVE_PORT is likely deprecated now - keeping it commented out
    // BRAVE_PORT: process.env.BRAVE_PORT || 3002, 
    VISA_REQUEST_TIMEOUT: parseInt(process.env.VISA_REQUEST_TIMEOUT) || 30000,
    CULTURE_REQUEST_TIMEOUT: parseInt(process.env.CULTURE_REQUEST_TIMEOUT) || 30000,
    // Service URLs are optional - proxyController defaults to localhost if not set
    VISA_SERVICE_URL: process.env.VISA_SERVICE_URL,
    CULTURE_SERVICE_URL: process.env.CULTURE_SERVICE_URL,
    WAIT_FOR_SERVERS: process.env.WAIT_FOR_SERVERS === 'true',
    NODE_ENV: process.env.NODE_ENV || 'development'
};
