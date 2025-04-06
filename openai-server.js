// Add retry logic
const axios = require('axios');
const axiosRetry = require('axios-retry');

axiosRetry(axios, { 
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
           error.response?.status === 429; // Rate limit error
  }
}); 