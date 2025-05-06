const path = require('path');
const env = require('./env');

const servers = [
  {
    name: 'AI Itinerary Generator',
    command: `node ${path.join(__dirname, '..', 'openai-server.js')}`,
    port: env.AI_SERVER_PORT || 8001,
    env: {
      PORT: env.AI_SERVER_PORT || 8001,
      OPENAI_API_KEY: env.OPENAI_API_KEY
    },
    healthCheckPath: '/health',
    healthCheckTimeout: 30000,
    retries: 3
  },
  {
    name: 'Travel Planner MCP Server',
    command: `node ${path.join(__dirname, '..', 'mapbox-travel-planner.js')}`,
    port: env.TRAVEL_PLANNER_PORT,
    env: { MAPBOX_API_KEY: env.MAPBOX_API_KEY }
  },
  {
    name: 'Live Events MCP Server',
    command: `node ${path.join(__dirname, '..', 'live-events-server.js')}`,
    port: env.LIVE_EVENTS_PORT,
    env: { TICKETMASTER_API_KEY: env.TICKETMASTER_API_KEY }
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
  },
  {
    name: 'Airbnb MCP Server',
    command: `npx -y @openbnb/mcp-server-airbnb --port ${env.AIRBNB_PORT || 8007} --host 0.0.0.0`,
    port: env.AIRBNB_PORT || 8007,
    env: {
      IGNORE_ROBOTS_TXT: process.env.IGNORE_ROBOTS_TXT || 'false',
      PORT: env.AIRBNB_PORT || 8007,
      DEBUG: 'airbnb:*',
      HOST: '0.0.0.0'
    },
    healthCheckPath: '/health',
    healthCheckTimeout: 60000,
  },
  {
    name: 'Visa Requirements Server',
    command: `node ${path.join(__dirname, '..', 'visa-requirements-server.js')}`,
    port: env.VISA_REQUIREMENTS_PORT || 8009,
    remoteUrl: env.VISA_SERVICE_URL,
    env: {
      PORT: env.VISA_REQUIREMENTS_PORT || 8009,
      BRAVE_MCP_URL: env.BRAVE_MCP_URL,
      BRAVE_API_ENDPOINT: env.BRAVE_API_ENDPOINT,
      VISA_REQUIREMENTS_PORT: env.VISA_REQUIREMENTS_PORT || 8009,
      VISA_REQUEST_TIMEOUT: env.VISA_REQUEST_TIMEOUT
    },
    healthCheckPath: '/health',
    healthCheckTimeout: 90000,
    retries: 3
  },
  {
    name: 'Culture Insights Server',
    command: `node ${path.join(__dirname, '..', 'culture-insights-server.js')}`,
    port: env.CULTURE_INSIGHTS_PORT || 8008,
    remoteUrl: env.CULTURE_SERVICE_URL,
    env: {
      PORT: env.CULTURE_INSIGHTS_PORT || 8008,
      BRAVE_MCP_URL: env.BRAVE_MCP_URL,
      BRAVE_API_ENDPOINT: env.BRAVE_API_ENDPOINT,
      CULTURE_INSIGHTS_PORT: env.CULTURE_INSIGHTS_PORT || 8008,
      CULTURE_REQUEST_TIMEOUT: env.CULTURE_REQUEST_TIMEOUT
    },
    healthCheckPath: '/health',
    healthCheckTimeout: 90000,
    retries: 5
  },
  {
    name: 'Brave LLM Service',
    command: `node ${path.join(__dirname, '..', 'brave-llm-server.js')}`,
    port: env.BRAVE_LLM_PORT,
    env: {
      BRAVE_LLM_PORT: env.BRAVE_LLM_PORT,
      PORT: env.BRAVE_LLM_PORT,
    },
    healthCheckPath: '/health',
    healthCheckTimeout: 30000,
    retries: 3
  },
];

module.exports = servers;