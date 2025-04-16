// Propose changes to AldaleelMCP/controllers/proxyController.js

const axios = require('axios');
const { createServerLogger } = require('../server-logger');
const env = require('../config/env');

const logger = createServerLogger('ProxyController');
// Ports might still be useful for local testing or reference, but URLs are primary for proxying
const AIRBNB_PORT = env.AIRBNB_PORT || 8007;
// const VISA_REQUIREMENTS_PORT = env.VISA_REQUIREMENTS_PORT || 8008; // No longer directly used for URL construction
// const CULTURE_INSIGHTS_PORT = process.env.CULTURE_INSIGHTS_PORT || 8008; // No longer directly used for URL construction

// Fetch the full service URLs from environment variables
const VISA_SERVICE_URL = env.VISA_SERVICE_URL; // e.g., [https://aldaleel-visa-service.onrender.com](https://aldaleel-visa-service.onrender.com)
const CULTURE_SERVICE_URL = env.CULTURE_SERVICE_URL; // e.g., [https://aldaleel-culture-service.onrender.com](https://aldaleel-culture-service.onrender.com)

// Proxy visa requirements request to visa-requirements-server
async function proxyVisaRequest(requestData) {
  // Use the environment variable for the full URL
  const targetUrl = `${VISA_SERVICE_URL}/visa-requirements`;
  logger.info(`Proxying visa request to: ${targetUrl}`, requestData);
  try {
    // Make sure VISA_SERVICE_URL is defined (handled by env.js validation)
    if (!VISA_SERVICE_URL) {
        throw new Error('VISA_SERVICE_URL environment variable is not set.');
    }
    const response = await axios.post(targetUrl, requestData);
    return response.data;
  } catch (error) {
    logger.error(`Error proxying to Visa service (${targetUrl}):`, error.message);
    if (error.response) {
      throw {
        message: error.response.data?.message || 'Visa service error',
        code: 'VISA_SERVICE_ERROR',
        statusCode: error.response.status,
        response: error.response
      };
    }
    throw {
      message: error.message || 'Visa service unavailable or network error',
      code: 'VISA_SERVICE_UNAVAILABLE'
    };
  }
}

// Helper function to proxy culture insights requests
async function proxyCultureInsightsRequest(requestData) {
  // Use the environment variable for the full URL
  const targetUrl = `${CULTURE_SERVICE_URL}/culture-insights`;
  logger.info(`Proxying culture request to: ${targetUrl}`, requestData);
  try {
     // Make sure CULTURE_SERVICE_URL is defined (handled by env.js validation)
    if (!CULTURE_SERVICE_URL) {
        throw new Error('CULTURE_SERVICE_URL environment variable is not set.');
    }
    const response = await axios.post(targetUrl, requestData);
    return response.data;
  } catch (error) {
    logger.error(`Error proxying to Culture service (${targetUrl}):`, error.message);
    if (error.response) {
      throw {
        message: error.response.data?.message || 'Culture service error',
        code: 'CULTURE_SERVICE_ERROR',
        statusCode: error.response.status,
        response: error.response
      };
    }
    throw {
      message: error.message || 'Culture service unavailable or network error',
      code: 'CULTURE_SERVICE_UNAVAILABLE'
    };
  }
}

async function testAirbnbConnection() {
  // This might also need updating if the Airbnb service is deployed separately
  // For now, assuming it might still run locally or needs its own URL env var if deployed.
  // If deployed, add AIRBNB_SERVICE_URL to env.js and use it here.
  const targetUrl = `http://localhost:${AIRBNB_PORT}/health`; // Keep as is for now, or update if needed
  logger.info(`Testing Airbnb connection to: ${targetUrl}`);
  try {
    const response = await axios.get(targetUrl);
    return {
      connected: true,
      status: response.data?.status || 'ok',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error(`Error testing Airbnb connection (${targetUrl}):`, error.message);
    throw {
      message: 'Failed to connect to Airbnb service',
      code: 'CONNECTION_ERROR',
      details: error.message
    };
  }
}

module.exports = {
  proxyVisaRequest,
  proxyCultureInsightsRequest,
  testAirbnbConnection
};