const dotenv = require('dotenv');

dotenv.config();

const requiredEnvVars = [
  'OPENAI_API_KEY', 'AI_SERVER_PORT',
  'EXA_API_KEY', 'DATA_SERVER_PORT',
  'SUPABASE_URL', 'SUPABASE_KEY',
  'TRAVEL_PLANNER_PORT',
  'TICKETMASTER_API_KEY', 'LIVE_EVENTS_PORT',
  'TRIPADVISOR_API_KEY', 'TRIPADVISOR_PORT',
  'BRAVE_API_KEY', 'BRAVE_PORT'
];

const validateEnv = () => {
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  }
};

validateEnv();

module.exports = {
  PORT: process.env.PORT || 8000,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  AI_SERVER_PORT: process.env.AI_SERVER_PORT,
  EXA_API_KEY: process.env.EXA_API_KEY,
  DATA_SERVER_PORT: process.env.DATA_SERVER_PORT,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  TRAVEL_PLANNER_PORT: process.env.TRAVEL_PLANNER_PORT,
  TICKETMASTER_API_KEY: process.env.TICKETMASTER_API_KEY,
  LIVE_EVENTS_PORT: process.env.LIVE_EVENTS_PORT,
  TRIPADVISOR_API_KEY: process.env.TRIPADVISOR_API_KEY,
  TRIPADVISOR_PORT: process.env.TRIPADVISOR_PORT || 8006,
  BRAVE_API_KEY: process.env.BRAVE_API_KEY,
  BRAVE_PORT: process.env.BRAVE_PORT,
  WAIT_FOR_SERVERS: process.env.WAIT_FOR_SERVERS === 'true',
  NODE_ENV: process.env.NODE_ENV || 'development'
};