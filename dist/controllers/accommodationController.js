"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const axios = require('axios');
const { createServerLogger } = require('../server-logger');
const env = require('../config/env');
const logger = createServerLogger('AccommodationController');
const AIRBNB_PORT = env.AIRBNB_PORT || 8007;
const AIRBNB_BASE_URL = `http://localhost:${AIRBNB_PORT}`;
// Search accommodations through Airbnb MCP server
function searchAccommodations(searchParams) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            logger.info('Searching accommodations with params:', searchParams);
            const response = yield axios.post(`${AIRBNB_BASE_URL}/airbnb_search`, searchParams);
            return response.data;
        }
        catch (error) {
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
    });
}
// Get accommodation details by listing ID
function getAccommodationDetails(listingId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            logger.info('Fetching accommodation details for listing:', listingId);
            const response = yield axios.get(`${AIRBNB_BASE_URL}/airbnb_listing_details`, {
                params: { listing_id: listingId }
            });
            return response.data;
        }
        catch (error) {
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
    });
}
module.exports = {
    searchAccommodations,
    getAccommodationDetails
};
