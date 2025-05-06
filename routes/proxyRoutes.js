const express = require('express');
const { createServerLogger } = require('../server-logger');
const proxyController = require('../controllers/proxyController');

const router = express.Router();
const logger = createServerLogger('ProxyRoutes');

router.post('/visa-requirements', async (req, res) => {
  try {
    const result = await proxyController.proxyVisaRequest(req.body);
    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    logger.error('Error proxying visa request:', error);
    const statusCode = error.response?.status || 502;
    res.status(statusCode).json({
      status: 'error',
      code: error.code || 'PROXY_ERROR',
      message: 'Failed to proxy visa requirements request',
      details: error.message
    });
  }
});

router.get('/test-airbnb-connection', async (req, res) => {
  try {
    const result = await proxyController.testAirbnbConnection();
    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    logger.error('Error testing Airbnb connection:', error);
    res.status(502).json({
      status: 'error',
      code: 'CONNECTION_ERROR',
      message: 'Failed to connect to Airbnb service',
      details: error.message
    });
  }
});

router.post('/culture-insights', async (req, res) => {
  try {
    const result = await proxyController.proxyCultureInsightsRequest(req.body);
    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    logger.error('Error proxying culture insights request:', error);
    const statusCode = error.response?.status || 502;
    res.status(statusCode).json({
      status: 'error',
      code: error.code || 'PROXY_ERROR',
      message: 'Failed to proxy culture insights request',
      details: error.message
    });
  }
});

module.exports = router;