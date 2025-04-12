const axios = require('axios');
const { createServerLogger } = require('../server-logger');
const env = require('../config/env');

const logger = createServerLogger('AccommodationController');
const AIRBNB_PORT = env.AIRBNB_PORT || 8007;
const AIRBNB_BASE_URL = `http://localhost:${AIRBNB_PORT}`;

// Search accommodations through Airbnb MCP server
async function searchAccommodations(searchParams) {
  try {
    logger.info('Searching accommodations with params:', searchParams);
    const response = await axios.post(`${AIRBNB_BASE_URL}/airbnb_search`, searchParams);
    return response.data;
  } catch (error) {
    logger.error('Error in searchAccommodations:', error);
    if (error.response) {
      throw {
        message: error.response.data.message || 'Airbnb search service error',
        code: 'AIRBNB_SERVICE_ERROR',
        response: error.response
      };
    }
    throw {
      message: error.message,
      code: 'AIRBNB_SERVICE_UNAVAILABLE'
    };
  }
}

// Get accommodation details by listing ID
async function getAccommodationDetails(listingId) {
  try {
    logger.info('Fetching accommodation details for listing:', listingId);
    const response = await axios.get(`${AIRBNB_BASE_URL}/airbnb_listing_details`, {
      params: { listing_id: listingId }
    });
    return response.data;
  } catch (error) {
    logger.error('Error in getAccommodationDetails:', error);
    if (error.response) {
      throw {
        message: error.response.data.message || 'Airbnb details service error',
        code: 'AIRBNB_SERVICE_ERROR',
        response: error.response
      };
    }
    throw {
      message: error.message,
      code: 'AIRBNB_SERVICE_UNAVAILABLE'
    };
  }
}

module.exports = {
  searchAccommodations,
  getAccommodationDetails
};