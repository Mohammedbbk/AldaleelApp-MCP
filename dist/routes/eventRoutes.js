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
const { proxyEventRequest } = require('../controllers/eventController');
const { createServerLogger } = require('../server-logger');
const router = express.Router();
const logger = createServerLogger('EventRoutes');
/**
 * @swagger
 * /api/events:
 *   post:
 *     summary: Forward event requests to Live Events MCP Server
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Event request processed successfully
 *       502:
 *         description: Failed to proxy event request
 */
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield proxyEventRequest(req.body);
        res.json(result);
    }
    catch (error) {
        logger.error('Failed to handle event request:', error);
        res.status(error.status || 502).json({
            status: 'error',
            message: error.message,
            details: error.details
        });
    }
}));
module.exports = router;
