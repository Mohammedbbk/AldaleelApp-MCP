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
const logger = createServerLogger('EventController');
const proxyEventRequest = (requestBody) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const eventsPort = env.LIVE_EVENTS_PORT || 8005;
        const response = yield axios.post(`http://127.0.0.1:${eventsPort}/events`, requestBody);
        return response.data;
    }
    catch (error) {
        logger.error('Error proxying event request:', error);
        throw {
            status: ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || 502,
            message: 'Failed to proxy event request',
            details: error.message
        };
    }
});
module.exports = {
    proxyEventRequest
};
