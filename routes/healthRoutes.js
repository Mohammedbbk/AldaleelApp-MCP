const express = require('express');
const { checkConnection } = require('../config/supabaseClient');
const { createServerLogger } = require('../server-logger');

const router = express.Router();
const logger = createServerLogger('HealthRoutes');

router.get('/', async (req, res) => {
  try {
    const dbStatus = await checkConnection();
    res.json({
      status: dbStatus ? 'ok' : 'degraded',
      database: dbStatus ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      details: error.message
    });
  }
});

module.exports = router;