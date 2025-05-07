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
    const params = {
      apikey: TICKETMASTER_API_KEY,
      city: location,
      startDateTime: startDate, // Expected format YYYY-MM-DDTHH:mm:ssZ
      endDateTime: endDate,   // Expected format YYYY-MM-DDTHH:mm:ssZ
      size: 20 // Default size, can be made configurable
    };

    const requestUrl = `${TICKETMASTER_API_URL}/events.json`;
    logger.info(`[${SERVICE_NAME}] Preparing to call Ticketmaster API. URL: ${requestUrl}, Params: ${JSON.stringify(params)}`);

    const response = await axios.get(requestUrl, { params });

    // Log a snippet of the raw response to see what Ticketmaster returned
    if (response.data && response.data._embedded && response.data._embedded.events) {
      logger.info(`[${SERVICE_NAME}] Ticketmaster returned ${response.data._embedded.events.length} events.`);
    } else if (response.data && response.data.page) {
      logger.info(`[${SERVICE_NAME}] Ticketmaster returned 0 events. Page info: ${JSON.stringify(response.data.page)}`);
    } else {
      logger.warn(`[${SERVICE_NAME}] Ticketmaster response structure unexpected or no events found. Response data: ${JSON.stringify(response.data)}`);
    }

    return response.data;
  } catch (error) {
    logger.error(`[${SERVICE_NAME}] Error fetching events from Ticketmaster: ${error.message}`, {
      url: error.config?.url,
      params: error.config?.params,
      status: error.response?.status,
      data: error.response?.data
    });
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
    
    // Expect destination, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)
    // Keep duration for fallback compatibility
    const { destination, startDate, endDate, duration } = req.body;
    
    if (!destination) {
      return res.status(400).json({
        error: 'Missing required parameter: destination'
      });
    }

    let queryStartDateTime, queryEndDateTime;
    
    if (startDate && endDate) {
      // Primary path: startDate and endDate are provided as "YYYY-MM-DD"
      queryStartDateTime = startDate + 'T00:00:00Z';
      queryEndDateTime = endDate + 'T23:59:59Z';
      logger.info(`[${SERVICE_NAME}] Using provided startDate: ${startDate} and endDate: ${endDate}`);
    } else if (startDate && duration) {
      // Fallback: startDate (potentially "YYYY-MM") and duration provided
      logger.warn(`[${SERVICE_NAME}] endDate not provided. Calculating from startDate: ${startDate} and duration: ${duration} to cover 'duration' days.`);
      let startDateObj;
      if (startDate.length <= 7 && startDate.includes('-')) { // "YYYY-MM" format
        const [yearStr, monthStr] = startDate.split('-');
        startDateObj = new Date(Date.UTC(parseInt(yearStr), parseInt(monthStr) - 1, 1));
      } else { // Assume "YYYY-MM-DD" or other Date-parsable format, ensure UTC context
        const d = new Date(startDate); // Parse locally first to get components
        startDateObj = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      }

      const endDateObj = new Date(startDateObj);
      endDateObj.setUTCDate(startDateObj.getUTCDate() + (parseInt(duration) || 7) - 1); // -1 to cover 'duration' days inclusive of start

      queryStartDateTime = startDateObj.toISOString().split('T')[0] + 'T00:00:00Z';
      queryEndDateTime = endDateObj.toISOString().split('T')[0] + 'T23:59:59Z';
    } else if (startDate) {
      // Fallback: Only startDate provided, use default duration (7 days)
      logger.warn(`[${SERVICE_NAME}] endDate and duration not provided. Using startDate: ${startDate} and default 7-day event window.`);
      let startDateObj;
      if (startDate.length <= 7 && startDate.includes('-')) { // "YYYY-MM" format
        const [yearStr, monthStr] = startDate.split('-');
        startDateObj = new Date(Date.UTC(parseInt(yearStr), parseInt(monthStr) - 1, 1));
      } else { // Assume "YYYY-MM-DD" or other Date-parsable format, ensure UTC context
        const d = new Date(startDate);
        startDateObj = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      }
      const endDateObj = new Date(startDateObj);
      endDateObj.setUTCDate(startDateObj.getUTCDate() + 7 - 1); // Default 7 days duration, -1 for inclusive end

      queryStartDateTime = startDateObj.toISOString().split('T')[0] + 'T00:00:00Z';
      queryEndDateTime = endDateObj.toISOString().split('T')[0] + 'T23:59:59Z';
    } else {
      // Fallback: No date information, use current date and default duration (7 days)
      logger.warn(`[${SERVICE_NAME}] No date information provided. Using current date and default 7-day event window.`);
      const startDateObj = new Date(); // Current local date
      // Convert to UTC midnight for consistency
      const currentUTCDate = new Date(Date.UTC(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate()));
      
      const endDateObj = new Date(currentUTCDate);
      endDateObj.setUTCDate(currentUTCDate.getUTCDate() + (parseInt(duration) || 7) - 1); // Use duration if somehow passed, else 7 days

      queryStartDateTime = currentUTCDate.toISOString().split('T')[0] + 'T00:00:00Z';
      queryEndDateTime = endDateObj.toISOString().split('T')[0] + 'T23:59:59Z';
    }
    
    // const eventsData = await getEvents(destination, formattedStartDate, formattedEndDate);
    logger.info(`[${SERVICE_NAME}] Fetching events for ${destination} from ${queryStartDateTime} to ${queryEndDateTime}`);
    const eventsData = await getEvents(destination, queryStartDateTime, queryEndDateTime);
    
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