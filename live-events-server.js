const express = require('express');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');
const { createServerLogger, createRequestLogger } = require('./server-logger');

dotenv.config();
const app = express();
const logger = createServerLogger('LiveEvents');

app.use(cors());
app.use(express.json());
app.use(createRequestLogger(logger));

const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;
const TICKETMASTER_API_URL = 'https://app.ticketmaster.com/discovery/v2';

async function getEvents(location, startDate, endDate) {
  try {
    const response = await axios.get(`${TICKETMASTER_API_URL}/events.json`, {
      params: {
        apikey: TICKETMASTER_API_KEY,
        city: location,
        startDateTime: startDate,
        endDateTime: endDate,
        size: 20
      }
    });

    return response.data;
  } catch (error) {
    logger.error('Error fetching events:', error);
    throw error;
  }
}

app.post('/events', async (req, res) => {
  try {
    const { location, startDate, endDate } = req.body;
    
    if (!location || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing required parameters: location, startDate, and endDate'
      });
    }

    const events = await getEvents(location, startDate, endDate);
    res.json(events);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch events',
      details: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.LIVE_EVENTS_PORT || 8005;
app.listen(PORT, () => {
  logger.info(`Live Events MCP Server running on port ${PORT}`);
});