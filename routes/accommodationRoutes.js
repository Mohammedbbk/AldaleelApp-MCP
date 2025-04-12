const express = require('express');
const { createServerLogger } = require('../server-logger');
const accommodationController = require('../controllers/accommodationController');

const router = express.Router();
const logger = createServerLogger('AccommodationRoutes');

// Search accommodations
router.post('/search', async (req, res) => {
  try {
    const result = await accommodationController.searchAccommodations(req.body);
    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    logger.error('Error searching accommodations:', error);
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({
      status: 'error',
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: 'Failed to search accommodations',
      details: error.message
    });
  }
});

// Get accommodation details by listing ID
router.get('/:listingId', async (req, res) => {
  try {
    const { listingId } = req.params;
    const result = await accommodationController.getAccommodationDetails(listingId);
    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    logger.error('Error fetching accommodation details:', error);
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({
      status: 'error',
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: 'Failed to fetch accommodation details',
      details: error.message
    });
  }
});

module.exports = router;