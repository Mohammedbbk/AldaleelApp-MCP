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
const { checkConnection } = require('../config/supabaseClient');
const { createServerLogger } = require('../server-logger');
const router = express.Router();
const logger = createServerLogger('HealthRoutes');
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dbStatus = yield checkConnection();
        res.json({
            status: dbStatus ? 'ok' : 'degraded',
            database: dbStatus ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger.error('Health check failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Health check failed',
            details: error.message
        });
    }
}));
module.exports = router;
