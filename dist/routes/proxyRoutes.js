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
const express = require('express');
const { createServerLogger } = require('../server-logger');
const proxyController = require('../controllers/proxyController');
const router = express.Router();
const logger = createServerLogger('ProxyRoutes');
// Proxy visa requirements request
router.post('/visa-requirements', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const result = yield proxyController.proxyVisaRequest(req.body);
        res.json({
            status: 'success',
            data: result
        });
    }
    catch (error) {
        logger.error('Error proxying visa request:', error);
        const statusCode = ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || 502;
        res.status(statusCode).json({
            status: 'error',
            code: error.code || 'PROXY_ERROR',
            message: 'Failed to proxy visa requirements request',
            details: error.message
        });
    }
}));
// Test Airbnb connection
router.get('/test-airbnb-connection', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield proxyController.testAirbnbConnection();
        res.json({
            status: 'success',
            data: result
        });
    }
    catch (error) {
        logger.error('Error testing Airbnb connection:', error);
        res.status(502).json({
            status: 'error',
            code: 'CONNECTION_ERROR',
            message: 'Failed to connect to Airbnb service',
            details: error.message
        });
    }
}));
// Proxy culture insights request
router.post('/culture-insights', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const result = yield proxyController.proxyCultureInsightsRequest(req.body);
        res.json({
            status: 'success',
            data: result
        });
    }
    catch (error) {
        logger.error('Error proxying culture insights request:', error);
        const statusCode = ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || 502;
        res.status(statusCode).json({
            status: 'error',
            code: error.code || 'PROXY_ERROR',
            message: 'Failed to proxy culture insights request',
            details: error.message
        });
    }
}));
module.exports = router;
