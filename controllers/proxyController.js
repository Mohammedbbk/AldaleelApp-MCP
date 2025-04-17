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
  const VISA_SERVICE_URL = env.VISA_SERVICE_URL;
  const CULTURE_SERVICE_URL = env.CULTURE_SERVICE_URL;

  // Proxy visa requirements request to visa-requirements-server
  async function proxyVisaRequest(requestData) {
    // Use the environment variable for the full URL if available, otherwise fallback to localhost
    const targetUrl = VISA_SERVICE_URL 
      ? `${VISA_SERVICE_URL}/visa-requirements` 
      : `http://127.0.0.1:${env.VISA_REQUIREMENTS_PORT || 8009}/visa-requirements`;
    
    logger.info(`[DEBUG] Attempting to proxy visa request to target URL: ${targetUrl}`);
    logger.info(`Proxying visa request to: ${targetUrl}`, requestData);
    try {
      const response = await axios.post(targetUrl, requestData, { timeout: env.VISA_REQUEST_TIMEOUT || 30000 });
      return response.data;
    } catch (error) {
      logger.error(`Error proxying to Visa service (${targetUrl}):`, error.message);
      
      // If connection refused, provide a more helpful error
      if (error.code === 'ECONNREFUSED') {
        throw {
          message: `Visa service is unavailable. The service at ${targetUrl} refused the connection. Check if the service is running and the URL is correct.`,
          code: 'VISA_SERVICE_UNAVAILABLE',
          details: error.message
        };
      }
      
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
        code: 'VISA_SERVICE_UNAVAILABLE',
        details: error.message // Include original error details
      };
    }
  }

  // Helper function to proxy culture insights requests
  async function proxyCultureInsightsRequest(requestData) {
    // Use the environment variable for the full URL if available, otherwise fallback to localhost
    const targetUrl = CULTURE_SERVICE_URL 
      ? `${CULTURE_SERVICE_URL}/culture-insights` 
      : `http://127.0.0.1:${env.CULTURE_INSIGHTS_PORT || 8008}/culture-insights`;
    
    logger.info(`[DEBUG] Attempting to proxy culture insights request to target URL: ${targetUrl}`);
    logger.info(`Proxying culture request to: ${targetUrl}`, requestData);
    try {
      const response = await axios.post(targetUrl, requestData, { timeout: env.CULTURE_REQUEST_TIMEOUT || 30000 });
      return response.data;
    } catch (error) {
      logger.error(`Error proxying to Culture service (${targetUrl}):`, error.message);
      
      // If connection refused, provide a more helpful error
      if (error.code === 'ECONNREFUSED') {
        throw {
          message: `Culture service is unavailable. The service at ${targetUrl} refused the connection. Check if the service is running and the URL is correct.`,
          code: 'CULTURE_SERVICE_UNAVAILABLE',
          details: error.message
        };
      }
      
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
        code: 'CULTURE_SERVICE_UNAVAILABLE',
        details: error.message // Include original error details
      };
    }
  }

  async function testAirbnbConnection() {
    // Assuming Airbnb service runs locally or needs its own URL if deployed separately
    const targetUrl = `http://127.0.0.1:${env.AIRBNB_PORT || 8007}/health`; 
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