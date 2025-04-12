const axios = require('axios');
const { createServerLogger } = require('../server-logger');
const env = require('../config/env');

const logger = createServerLogger('ProxyController');
const AIRBNB_PORT = env.AIRBNB_PORT || 8007;
const VISA_REQUIREMENTS_PORT = env.VISA_REQUIREMENTS_PORT || 8008; // Changed to match visa-requirements-server.js and avoid port conflict

// Proxy visa requirements request to visa-requirements-server
async function proxyVisaRequest(requestData) {
  try {
    logger.info('Proxying visa requirements request:', requestData);
    const response = await axios.post(`http://localhost:${VISA_REQUIREMENTS_PORT}/visa-requirements`, requestData);
    return response.data;
  } catch (error) {
    logger.error('Error in proxyVisaRequest:', error);
    if (error.response) {
      throw {
        message: error.response.data.message || 'Visa service error',
        code: 'VISA_SERVICE_ERROR',
        response: error.response
      };
    }
    throw {
      message: error.message || 'Visa service unavailable',
      code: 'VISA_SERVICE_UNAVAILABLE'
    };
  }
}

// Test connection to Airbnb MCP server
async function testAirbnbConnection() {
  try {
    logger.info('Testing Airbnb connection');
    const response = await axios.get(`http://localhost:${AIRBNB_PORT}/health`);
    return {
      connected: true,
      status: response.data.status || 'ok',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error in testAirbnbConnection:', error);
    throw {
      message: 'Failed to connect to Airbnb service',
      code: 'CONNECTION_ERROR',
      details: error.message
    };
  }
}

module.exports = {
  proxyVisaRequest,
  testAirbnbConnection
};