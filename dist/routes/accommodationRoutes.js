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
const accommodationController = require('../controllers/accommodationController');
const router = express.Router();
const logger = createServerLogger('AccommodationRoutes');
// Search accommodations
router.post('/search', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const result = yield accommodationController.searchAccommodations(req.body);
        res.json({
            status: 'success',
            data: result
        });
    }
    catch (error) {
        logger.error('Error searching accommodations:', error);
        const statusCode = ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || 500;
        res.status(statusCode).json({
            status: 'error',
            code: error.code || 'INTERNAL_SERVER_ERROR',
            message: 'Failed to search accommodations',
            details: error.message
        });
    }
}));
// Get accommodation details by listing ID
router.get('/:listingId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { listingId } = req.params;
        const result = yield accommodationController.getAccommodationDetails(listingId);
        res.json({
            status: 'success',
            data: result
        });
    }
    catch (error) {
        logger.error('Error fetching accommodation details:', error);
        const statusCode = ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) || 500;
        res.status(statusCode).json({
            status: 'error',
            code: error.code || 'INTERNAL_SERVER_ERROR',
            message: 'Failed to fetch accommodation details',
            details: error.message
        });
    }
}));
module.exports = router;
