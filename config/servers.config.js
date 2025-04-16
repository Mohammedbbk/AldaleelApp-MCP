const path = require('path'); // Make sure path is required
const env = require('./env'); // Make sure env is required

const servers = [
  {
    name: 'AI Itinerary Generator', // Uses openai-server.js
    command: `node ${path.join(__dirname, '..', 'openai-server.js')}`,
    port: env.AI_SERVER_PORT || 8001, // Default to 8001
    env: {
      PORT: env.AI_SERVER_PORT || 8001, // Pass port if needed by server
      OPENAI_API_KEY: env.OPENAI_API_KEY // Pass API key
      // Add other env vars if openai-server.js needs them
    },
    healthCheckPath: '/health',
    healthCheckTimeout: 30000,
    retries: 3
  },
  {
    name: 'Travel Planner MCP Server',
    command: `node ${path.join(__dirname, '..', 'mapbox-travel-planner.js')}`,
    port: env.TRAVEL_PLANNER_PORT, // Default: 8002
    env: { MAPBOX_API_KEY: env.MAPBOX_API_KEY }
    // Add health check if available
  },
  {
    name: 'Live Events MCP Server',
    command: `node ${path.join(__dirname, '..', 'live-events-server.js')}`,
    port: env.LIVE_EVENTS_PORT, // Default: 8005
    env: { TICKETMASTER_API_KEY: env.TICKETMASTER_API_KEY }
    // Add health check if available
  },
  {
    name: 'TripAdvisor MCP Server',
    command: 'python3 -m flask run --host=0.0.0.0 --port 8006',
    port: env.TRIPADVISOR_PORT || 8006,
    env: {
      TRIPADVISOR_API_KEY: env.TRIPADVISOR_API_KEY,
      PYTHONUNBUFFERED: '1',
      FLASK_APP: 'server.py',
      FLASK_ENV: 'development'
    },
    healthCheckTimeout: 30000,
    retries: 3
    // Add health check if available
  },
  {
    name: 'Airbnb MCP Server',
    command: `npx -y @openbnb/mcp-server-airbnb --port ${env.AIRBNB_PORT || 8007} --host 127.0.0.1`,
    port: env.AIRBNB_PORT || 8007, // Uses port 8007
    env: {
      IGNORE_ROBOTS_TXT: process.env.IGNORE_ROBOTS_TXT || 'false',
      PORT: env.AIRBNB_PORT || 8007,
      DEBUG: 'airbnb:*',
      HOST: '127.0.0.1'
    },
    healthCheckPath: '/health',
    healthCheckTimeout: 60000,
  },
  // --- CORRECTED VISA ENTRY (ONLY ONE) ---
  {
    name: 'Visa Requirements Server',
    command: `node ${path.join(__dirname, '..', 'visa-requirements-server.js')}`,
    port: env.VISA_REQUIREMENTS_PORT || 8009, // Uses unique port (e.g., 8009)
    env: {
      // Pass necessary environment variables from the main gateway's env
      PORT: env.VISA_REQUIREMENTS_PORT || 8009, // Pass its own port
      BRAVE_MCP_URL: env.BRAVE_MCP_URL,
      BRAVE_API_ENDPOINT: env.BRAVE_API_ENDPOINT,
      VISA_REQUIREMENTS_PORT: env.VISA_REQUIREMENTS_PORT || 8009, // Pass port again if needed internally
      VISA_REQUEST_TIMEOUT: env.VISA_REQUEST_TIMEOUT
      // Add BRAVE_PORT or BRAVE_API_KEY if visa-requirements-server needs them
    },
    healthCheckPath: '/health', // Assuming it has one
    healthCheckTimeout: 30000,
    retries: 3
  },
  // --- CORRECTED CULTURE ENTRY (ONLY ONE) ---
  {
    name: 'Culture Insights Server',
    command: `node ${path.join(__dirname, '..', 'culture-insights-server.js')}`,
    port: env.CULTURE_INSIGHTS_PORT || 8008, // Uses port 8008
    env: {
      PORT: env.CULTURE_INSIGHTS_PORT || 8008, // Pass its own port
      BRAVE_MCP_URL: env.BRAVE_MCP_URL,
      BRAVE_API_ENDPOINT: env.BRAVE_API_ENDPOINT,
      CULTURE_INSIGHTS_PORT: env.CULTURE_INSIGHTS_PORT || 8008, // Pass port again if needed internally
      CULTURE_REQUEST_TIMEOUT: env.CULTURE_REQUEST_TIMEOUT
       // Add BRAVE_PORT or BRAVE_API_KEY if culture-insights-server needs them
    },
    healthCheckPath: '/health', // Assuming it has one
    healthCheckTimeout: 35000,
    retries: 5
  },
  // Add Brave/LLM Service configuration
  {
    name: 'Brave LLM Service',
    command: `node ${path.join(__dirname, '..', 'brave-llm-server.js')}`,
    port: env.BRAVE_PORT || 3002, // Uses port 3002
    env: {
      PORT: env.BRAVE_PORT || 3002,
      // Add any other environment variables needed by the Brave LLM service
    },
    healthCheckPath: '/health',
    healthCheckTimeout: 30000,
    retries: 3
  },
  // --- REMOVED DUPLICATE AI ENTRY ---
];

module.exports = servers;