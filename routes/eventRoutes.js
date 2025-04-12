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
router.post('/', async (req, res) => {
  try {
    const result = await proxyEventRequest(req.body);
    res.json(result);
  } catch (error) {
    logger.error('Failed to handle event request:', error);
    res.status(error.status || 502).json({
      status: 'error',
      message: error.message,
      details: error.details
    });
  }
});

module.exports = router;