const axios = require('axios');
const { createServerLogger } = require('../server-logger');
const env = require('../config/env');

const logger = createServerLogger('EventController');

const proxyEventRequest = async (requestBody) => {
  try {
    const eventsPort = env.LIVE_EVENTS_PORT || 8005;
    const response = await axios.post(`http://127.0.0.1:${eventsPort}/events`, requestBody);
    return response.data;
  } catch (error) {
    logger.error('Error proxying event request:', error);
    throw {
      status: error.response?.status || 502,
      message: 'Failed to proxy event request',
      details: error.message
    };
  }
};

module.exports = {
  proxyEventRequest
};