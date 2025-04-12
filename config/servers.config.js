const path = require('path');
const env = require('./env');

const servers = [
  {
    name: 'AI Itinerary Generator',
    command: `node ${path.join(__dirname, '..', 'openai-server.js')}`,
    port: env.AI_SERVER_PORT,
    env: { OPENAI_API_KEY: env.OPENAI_API_KEY },
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
    command: `npx -y @openbnb/mcp-server-airbnb --port ${env.AIRBNB_PORT || 8007} --host 127.0.0.1`,
    port: env.AIRBNB_PORT || 8007,
    env: { 
      IGNORE_ROBOTS_TXT: process.env.IGNORE_ROBOTS_TXT || 'false',
      PORT: env.AIRBNB_PORT || 8007,
      DEBUG: 'airbnb:*',
      HOST: '127.0.0.1'
    },
    healthCheckPath: '/health',
    healthCheckTimeout: 60000,
    retries: 5
  }
];

module.exports = servers;