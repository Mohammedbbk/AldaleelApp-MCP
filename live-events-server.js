const express = require('express');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');
const { createServerLogger, createRequestLogger } = require('./server-logger');

dotenv.config();
const app = express();
const logger = createServerLogger('LiveEvents');
const SERVICE_NAME = 'Live Events';

app.use(cors());
app.use(express.json());

const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;
const TICKETMASTER_API_URL = 'https://app.ticketmaster.com/discovery/v2';

try {
  if (!TICKETMASTER_API_KEY) {
    logger.warn(`[${SERVICE_NAME}] TICKETMASTER_API_KEY environment variable not set.`);
  } else {
    logger.info(`[${SERVICE_NAME}] Ticketmaster API Key loaded.`);
  }
} catch (error) {
  logger.error(`[${SERVICE_NAME} Error] Initialization check failed:`, error);
  console.error(`[${SERVICE_NAME} Error] Initialization check failed: ${error.message}`);
}

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
    if (!TICKETMASTER_API_KEY) {
      logger.error(`[${SERVICE_NAME} Error] Attempted to fetch events but API key is missing.`);
      return res.status(503).json({
        error: 'Ticketmaster service unavailable - API key missing'
      });
    }
    
    const { destination, startDate, duration } = req.body;
    
    if (!destination) {
      return res.status(400).json({
        error: 'Missing required parameter: destination'
      });
    }

    // Calculate endDate from startDate and duration
    let formattedStartDate, formattedEndDate;
    
    if (startDate) {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(startDateObj);
      endDateObj.setDate(startDateObj.getDate() + (parseInt(duration) || 7));
      
      formattedStartDate = startDateObj.toISOString().split('T')[0] + 'T00:00:00Z';
      formattedEndDate = endDateObj.toISOString().split('T')[0] + 'T23:59:59Z';
    } else {
      // Default to current date if not provided
      const startDateObj = new Date();
      const endDateObj = new Date();
      endDateObj.setDate(startDateObj.getDate() + (parseInt(duration) || 7));
      
      formattedStartDate = startDateObj.toISOString().split('T')[0] + 'T00:00:00Z';
      formattedEndDate = endDateObj.toISOString().split('T')[0] + 'T23:59:59Z';
    }
    
    const eventsData = await getEvents(destination, formattedStartDate, formattedEndDate);
    
    // Format the response to match what tripService expects
    const formattedEvents = [];
    
    if (eventsData._embedded && eventsData._embedded.events) {
      eventsData._embedded.events.forEach(event => {
        formattedEvents.push({
          name: event.name,
          date: event.dates?.start?.localDate || 'TBD',
          time: event.dates?.start?.localTime || 'TBD',
          venue: event._embedded?.venues?.[0]?.name || 'TBD',
          type: event.classifications?.[0]?.segment?.name || 'Event',
          url: event.url
        });
      });
    }
    
    logger.info(`Found ${formattedEvents.length} events for ${destination}`);
    
    res.json({
      status: 'success',
      events: formattedEvents
    });
  } catch (error) {
    logger.error('Error fetching events:', error);
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
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`[${SERVICE_NAME}] Server listening successfully on port ${PORT}`);
  console.log(`[${SERVICE_NAME}] Server listening successfully on port ${PORT}`);
  if (!TICKETMASTER_API_KEY) {
     logger.warn(`[${SERVICE_NAME}] Server started, but Ticketmaster API key is MISSING.`);
  }
});

server.on('error', (error) => {
  logger.error(`[${SERVICE_NAME} Server Error] Failed to start server:`, error);
  console.error(`[${SERVICE_NAME} Server Error] Failed to start server: ${error.code} - ${error.message}`);
  process.exit(1);
});