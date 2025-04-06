const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const { createServerLogger, createRequestLogger } = require('../server-logger');

dotenv.config();

const requiredEnvVars = [
  'OPENAI_API_KEY', 'AI_SERVER_PORT',
  'EXA_API_KEY', 'DATA_SERVER_PORT',
  'SUPABASE_URL', 'SUPABASE_KEY',
 'TRAVEL_PLANNER_PORT',
  'TICKETMASTER_API_KEY', 'LIVE_EVENTS_PORT',
  'TRIPADVISOR_API_KEY', 'TRIPADVISOR_PORT',
  'BRAVE_API_KEY', 'BRAVE_PORT'  // Add these lines
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Add basic error handling for Supabase connection
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Add a simple health check
const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('trips').select('count');
    if (error) throw error;
    return true;
  } catch (error) {
    logger.error('Supabase connection error:', error);
    return false;
  }
};

/*
  MCP Servers Configuration:
  
  1. AI Itinerary Generator (PIAPI MCP Server):
     - Clone, install, build, and then run via Node.
     - Update the path below with your local installation directory.
  
  2. Exa Data Server:
     - Installed globally or via npx using "exa-mcp-server".
     
  3. Travel Planner MCP Server:
     - Using npx to run @gongrzhe/server-travelplanner-mcp
     
  4. MCP Live Events Server:
     - Using npx to run mcp-live-events
     
  5. TripAdvisor Vacation Planner MCP Server:
     - Using uv to run the server.py
*/
    // Update the Airbnb MCP Server configuration with better debugging options
const servers = [
  {
    name: 'AI Itinerary Generator',
    command: `node ${path.join(__dirname, 'openai-server.js')}`,
    port: process.env.AI_SERVER_PORT,
    env: { OPENAI_API_KEY: process.env.OPENAI_API_KEY }
  },
  // {
  //   name: 'Exa Data Server',
  //   command: `npx -y exa-mcp-server --api-key ${process.env.EXA_API_KEY} --port ${process.env.DATA_SERVER_PORT}`,
  //   port: process.env.DATA_SERVER_PORT
  // },
  {
    name: 'Travel Planner MCP Server',
    command: `node ${path.join(__dirname, '..', 'mapbox-travel-planner.js')}`,
    port: process.env.TRAVEL_PLANNER_PORT,
    env: { MAPBOX_API_KEY: process.env.MAPBOX_API_KEY }
  },
  {
    name: 'Live Events MCP Server',
    command: `node ${path.join(__dirname, '..', 'live-events-server.js')}`,
    port: process.env.LIVE_EVENTS_PORT,
    env: { TICKETMASTER_API_KEY: process.env.TICKETMASTER_API_KEY }
  },
  {
    name: 'TripAdvisor MCP Server',
    command: 'python3 -m flask run --host=0.0.0.0 --port 8006',
    port: process.env.TRIPADVISOR_PORT || 8006,
    env: { 
      TRIPADVISOR_API_KEY: process.env.TRIPADVISOR_API_KEY,
      PYTHONUNBUFFERED: '1',
      FLASK_APP: 'server.py',
      FLASK_ENV: 'development'
    }
  },
  {
    name: 'Airbnb MCP Server',
    command: `npx -y @openbnb/mcp-server-airbnb --port ${process.env.AIRBNB_PORT || 8007}`,
    port: process.env.AIRBNB_PORT || 8007,
    env: { 
      IGNORE_ROBOTS_TXT: process.env.IGNORE_ROBOTS_TXT || 'false',
      PORT: process.env.AIRBNB_PORT || 8007,
      DEBUG: 'airbnb:*' // Add debug flag for more verbose output
    },
    healthCheckPath: '/health',
    retries: 3 // Add retry attempts
  }
];

// Update the waitForServer function to be more flexible
const waitForServer = async (name, url, timeout) => {
  const startTime = Date.now();
  const server = servers.find(s => s.name === name);
  const healthPath = server.healthCheckPath || '/health';
  const maxRetries = server.retries || 1;
  let retryCount = 0;
  
  while (Date.now() - startTime < timeout) {
    try {
      logger.info(`Attempting to connect to ${name} at ${url}${healthPath} (Attempt ${retryCount + 1}/${maxRetries})`);
      const response = await axios.get(`${url}${healthPath}`, { timeout: 5000 });
      logger.info(`${name} is ready with status: ${JSON.stringify(response.data)}`);
      console.log(`${name} is ready`);
      return;
    } catch (error) {
      retryCount++;
      
      // Log more detailed error information
      if (error.response) {
        // The server responded with a status code outside the 2xx range
        logger.warn(`${name} responded with status ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        // The request was made but no response was received
        logger.warn(`${name} did not respond to request: ${error.message}`);
      } else {
        // Something happened in setting up the request
        logger.warn(`Error setting up request to ${name}: ${error.message}`);
      }
      
      if (retryCount >= maxRetries) {
        logger.warn(`Max retries (${maxRetries}) reached for ${name}`);
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Increase retry interval to 2 seconds
    }
  }
  
  // Throw a more detailed error
  const errorMsg = `Timeout waiting for ${name} to be ready at ${url}${healthPath} after ${retryCount} attempts`;
  logger.error(errorMsg);
  throw new Error(errorMsg);
};

// Update startMCPServers to handle errors better and add direct server testing
const startMCPServers = async () => {
  try {
    for (const server of servers) {
      logger.info(`Starting ${server.name}...`);
      console.log(`Starting ${server.name}...`);
      
      const options = server.env ? { env: { ...process.env, ...server.env } } : {};
      
      if (server.name === 'TripAdvisor MCP Server') {
        logger.info('Note: TripAdvisor MCP Server requires Python 3.10+ to run');
      }
      
      if (server.name === 'Airbnb MCP Server') {
        logger.info('Starting Airbnb MCP Server with options:', JSON.stringify(options));
        // Check if the package is installed
        try {
          require.resolve('@openbnb/mcp-server-airbnb');
          logger.info('Airbnb MCP Server package is installed');
        } catch (e) {
          logger.error('Airbnb MCP Server package is not installed. Error:', e.message);
        }
      }
      
      const childProcess = exec(server.command, options, (error, stdout, stderr) => {
        if (error) {
          logger.error(`${server.name} Error: ${error.message}`);
          console.error(`${server.name} Error: ${error.message}`);
          return;  // This return only exits the callback, not the loop
        }
        if (stderr) {
          logger.warn(`${server.name} Warning: ${stderr}`);
          console.warn(`${server.name} Warning: ${stderr}`);
        }
        logger.info(`${server.name} Output: ${stdout}`);
        console.log(`${server.name} Output: ${stdout}`);
      });
      
      // Add real-time logging for stdout and stderr
      if (server.name === 'Airbnb MCP Server') {
        if (childProcess.stdout) {
          childProcess.stdout.on('data', (data) => {
            logger.info(`${server.name} stdout: ${data.toString().trim()}`);
            console.log(`${server.name} stdout: ${data.toString().trim()}`);
          });
        }
        
        if (childProcess.stderr) {
          childProcess.stderr.on('data', (data) => {
            logger.warn(`${server.name} stderr: ${data.toString().trim()}`);
            console.warn(`${server.name} stderr: ${data.toString().trim()}`);
          });
        }
      }
      
      // Add delay between starting servers
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (process.env.WAIT_FOR_SERVERS === 'true') {
      console.log('Waiting for servers to initialize...');
      
      // Wait for servers sequentially instead of all at once
      for (const server of servers.filter(s => s.port)) {
        try {
          await waitForServer(server.name, 'http://localhost:' + server.port, 30000);
        } catch (error) {
          logger.error(`Failed to start ${server.name}: ${error.message}`);
          // Continue with other servers instead of failing completely
          
          // For Airbnb server specifically, try to diagnose the issue
          if (server.name === 'Airbnb MCP Server') {
            logger.info('Attempting to diagnose Airbnb MCP Server issue...');
            
            // Check if port is in use
            exec(`lsof -i :${server.port}`, (error, stdout) => {
              if (error) {
                logger.info(`Port ${server.port} does not appear to be in use by another process`);
              } else {
                logger.error(`Port ${server.port} may be in use by another process:\n${stdout}`);
              }
            });
            
            // Try to manually check the server
            try {
              await axios.get(`http://localhost:${server.port}`, { timeout: 2000 });
              logger.info(`Airbnb server is responding on port ${server.port} but health check failed`);
            } catch (e) {
              logger.error(`Airbnb server is not responding on port ${server.port}: ${e.message}`);
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error('Error starting MCP servers:', error);
    console.error('Error starting MCP servers:', error);
  }
};

const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = createServerLogger('Gateway');

startMCPServers();

const app = express();
app.use(cors());
app.use(express.json());
app.use(createRequestLogger(logger));

const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests, please try again later.'
  }
});

app.use(userLimiter);

const validateTravelPlanInput = (req, res, next) => {
  const { destination, days, budget, interests = [], userCountry = '', travelDates = '', travelStyle = '', dietaryRestrictions = [] } = req.body;
  const errors = [];

  if (!destination || typeof destination !== 'string' || destination.trim().length === 0) {
    errors.push('Destination is required and must be a non-empty string');
  }
  if (!days || typeof days !== 'number' || days < 1 || days > 30) {
    errors.push('Days must be a number between 1 and 30');
  }
  if (!budget || typeof budget !== 'number' || budget < 100) {
    errors.push('Budget must be a number greater than 100');
  }
  if (interests && !Array.isArray(interests)) {
    errors.push('Interests must be an array');
  }
  if (userCountry && typeof userCountry !== 'string') {
    errors.push('User country must be a string');
  }
  if (dietaryRestrictions && !Array.isArray(dietaryRestrictions)) {
    errors.push('Dietary restrictions must be an array');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      errors
    });
  }

  next();
};

const tripSchema = Joi.object({
  destination: Joi.string().required().min(2).max(100),
  days: Joi.number().integer().min(1).max(30).required(),
  budget: Joi.number().positive().required(),
  interests: Joi.array().items(Joi.string()).optional(),
  userCountry: Joi.string().optional(),
  travelDates: Joi.string().optional(),
  travelStyle: Joi.string().optional(),
  dietaryRestrictions: Joi.array().items(Joi.string()).optional()
});

// Add sanitization function
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  // Remove any HTML tags
  input = input.replace(/<[^>]*>/g, '');
  // Remove special characters but keep spaces, letters, numbers, and basic punctuation
  input = input.replace(/[^\w\s.,!?-]/g, '');
  // Trim whitespace
  return input.trim();
};

// API Route to generate travel plans
app.post('/generate', validateTravelPlanInput, async (req, res) => {
  const { error } = tripSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message
    });
  }
  try {
    const { 
      destination, 
      days, 
      budget, 
      interests = [], 
      userCountry = '', 
      travelDates = '', 
      travelStyle = '', 
      dietaryRestrictions = [] 
    } = req.body;
    
    const sanitizedDestination = sanitizeInput(destination);
    const sanitizedUserCountry = sanitizeInput(userCountry);
    const sanitizedTravelDates = sanitizeInput(travelDates);
    const sanitizedTravelStyle = sanitizeInput(travelStyle);
    const parsedDays = parseInt(days);
    const parsedBudget = parseFloat(budget);
    
    console.log('Processing request:', { 
      sanitizedDestination, 
      parsedDays, 
      parsedBudget, 
      interests,
      sanitizedUserCountry,
      sanitizedTravelDates,
      sanitizedTravelStyle,
      dietaryRestrictions
    });
    
    if (isNaN(parsedDays) || isNaN(parsedBudget) || !sanitizedDestination) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid input parameters'
      });
    }
    
    // Generate unique trip ID
    const tripId = Date.now().toString();
    
    console.log(`Sending request to AI server at http://localhost:${process.env.AI_SERVER_PORT}/generate`);
    
    // Build a more comprehensive prompt with the new information
    const prompt = `Create a detailed ${parsedDays}-day travel itinerary for ${sanitizedDestination} with a budget of $${parsedBudget}.
      ${interests.length > 0 ? `Focus on these interests: ${interests.join(', ')}.` : ''}
      ${sanitizedUserCountry ? `The traveler is from ${sanitizedUserCountry}.` : ''}
      ${sanitizedTravelDates ? `Travel dates: ${sanitizedTravelDates}.` : ''}
      ${sanitizedTravelStyle ? `Travel style preference: ${sanitizedTravelStyle}.` : ''}
      ${dietaryRestrictions.length > 0 ? `Dietary restrictions: ${dietaryRestrictions.join(', ')}.` : ''}
      
      Format your response as a structured JSON with the following sections:
      1. "visaRequirements": Detailed visa information for someone from ${sanitizedUserCountry || 'the traveler\'s country'} visiting ${sanitizedDestination}, including application process, fees, and requirements
      2. "localCustoms": Important cultural norms, etiquette, dress codes, and behaviors to be aware of
      3. "currencyInfo": Currency details, exchange rates, tipping customs, payment methods accepted
      4. "healthAndSafety": Vaccinations needed, health precautions, emergency numbers, safety tips
      5. "transportation": How to get around, public transit options, recommended transportation methods
      6. "languageBasics": Official language, common useful phrases, communication tips
      7. "weatherInfo": Seasonal weather patterns, what to expect during the travel period
      8. "dailyItinerary": Array of daily plans, each with morning, afternoon, and evening activities, including:
         - timing
         - activities
         - estimatedCosts
         - transportationOptions
         - accommodationSuggestions
         - mealRecommendations
      
      Make sure all the information is accurate, practical, and tailored to the traveler's specifics.`;
    
    console.log('Prompt:', prompt);
    
    const itinerary = await axios.post(`http://localhost:${process.env.AI_SERVER_PORT}/generate`, {
      prompt
    }).catch(error => {
      console.error('Detailed Itinerary Error:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status
      });
      throw error;
    });
    
    console.log('Received response from AI server');
    
    let parsedItinerary;
    try {
      // Try to parse the response as JSON
      const content = itinerary.data.data.content;
      parsedItinerary = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (parseError) {
      console.error('Error parsing itinerary as JSON:', parseError);
      // If parsing fails, use the raw content
      parsedItinerary = {
        rawContent: itinerary.data.data.content,
        parsingError: "The AI response couldn't be parsed as JSON. Please see rawContent."
      };
    }
    
    // Update the tripData construction with the new fields
    const tripData = {
      id: tripId,
      destination: sanitizedDestination,
      days: parsedDays,
      budget: parsedBudget,
      interests,
      user_country: sanitizedUserCountry,
      travel_dates: sanitizedTravelDates,
      travel_style: sanitizedTravelStyle,
      dietary_restrictions: dietaryRestrictions,
      itinerary: parsedItinerary,
      created_at: new Date().toISOString()
    };
    
    console.log('Saving trip data to Supabase');
    
    // Save trip data to Supabase
    const { data, error: dbError } = await supabase
      .from('trips')
      .insert([tripData]);
      
    if (dbError) {
      console.error('Supabase Error:', dbError);
      throw dbError;
    }

    console.log('Trip saved successfully');

    // Return the response with the structured itinerary
    res.json({
      status: 'success',
      data: {
        tripId,
        itinerary: parsedItinerary
      }
    });
    
  } catch (error) {
    console.error('Error generating travel plan:', error);
    console.error('Error stack:', error.stack);
    const statusCode = error.response?.status || 500;
    const errorResponse = {
      status: 'error',
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: 'Failed to generate travel plan',
      details: error.message,
      timestamp: new Date().toISOString()
    };
    
    if (error.response?.data) {
      errorResponse.serviceError = error.response.data;
    }
    
    res.status(statusCode).json(errorResponse);
  }
});

// API Route to retrieve an existing trip by ID from Supabase
   // Update the /trip/:tripId endpoint
   app.get('/trip/:tripId', async (req, res) => {
    try {
      const { tripId } = req.params;
      
      const { data: trip, error: dbError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();
        
      if (dbError) {
        if (dbError.code === 'PGRST116') { // Not found
          return res.status(404).json({
            status: 'error',
            code: 'NOT_FOUND',
            message: 'Trip not found'
          });
        }
        throw dbError;
      }
      
      res.json({
        status: 'success',
        data: trip
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ 
        status: 'error',
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve trip data',
        details: error.message 
      });
    }
  });

// Add pagination
app.get('/trips', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  
  const { data, count } = await supabase
    .from('trips')
    .select('*', { count: 'exact' })
    .range((page - 1) * limit, page * limit - 1);
    
  res.json({
    status: 'success',
    data,
    pagination: {
      current: page,
      total: Math.ceil(count / limit),
      perPage: limit
    }
  });
});

// Health check endpoint for the gateway server
// Enhance health check to include database status
app.get('/health', async (req, res) => {
  const dbStatus = await checkSupabaseConnection();
  res.json({ 
    status: dbStatus ? 'ok' : 'degraded',
    database: dbStatus ? 'connected' : 'disconnected'
  });
});

// Start the gateway server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  logger.info(`Gateway server running on port ${PORT}`);
  console.log(`Gateway server running on port ${PORT}`);
});

// Add connection management
let supabaseClient;

process.on('SIGTERM', async () => {
  if (supabaseClient) {
    await supabaseClient.disconnect();
  }
  process.exit(0);
});

// Add transaction support for trip updates
const updateTrip = async (tripId, newData) => {
  const { data, error } = await supabase.rpc('update_trip_with_lock', {
    p_trip_id: tripId,
    p_new_data: newData
  });
  // ...
}

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Daleel Travel API',
      version: '1.0.0',
    },
  },
  apis: ['./routes/*.js'],
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJsdoc(swaggerOptions)));

// Add this to your existing gateway server
app.post('/travel-plan', async (req, res) => {
  try {
    const { destination, nationality, ...otherDetails } = req.body;
    
    // Fetch visa requirements
    const visaResponse = await axios.post('http://localhost:8007/visa-requirements', {
      nationality,
      destination
    });

    const prompt = `
      Create a detailed travel plan for ${destination}.
      
      Visa Requirements:
      ${JSON.stringify(visaResponse.data.visaRequirements, null, 2)}
      
      Additional Travel Details:
      ${JSON.stringify(otherDetails, null, 2)}
      
      Please provide a comprehensive travel plan including visa requirements, necessary documentation, and travel recommendations.
    `;

    // Send to your LLM for processing
    const llmResponse = await processWithLLM(prompt);
    
    res.json(llmResponse);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate travel plan',
      details: error.message
    });
  }
});

// Add new routes for Airbnb integration
app.post('/accommodations/search', async (req, res) => {
  try {
    const {
      location,
      placeId,
      checkin,
      checkout,
      adults = 1,
      children = 0,
      infants = 0,
      pets = 0,
      minPrice,
      maxPrice,
      cursor
    } = req.body;

    if (!location) {
      return res.status(400).json({
        status: 'error',
        message: 'Location is required'
      });
    }

    const airbnbResponse = await axios.post(`http://localhost:${process.env.AIRBNB_PORT || 8007}/airbnb_search`, {
      location,
      placeId,
      checkin,
      checkout,
      adults,
      children,
      infants,
      pets,
      minPrice,
      maxPrice,
      cursor,
      ignoreRobotsText: process.env.IGNORE_ROBOTS_TXT === 'true'
    });

    res.json({
      status: 'success',
      data: airbnbResponse.data
    });
  } catch (error) {
    console.error('Airbnb search error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to search Airbnb listings',
      details: error.message
    });
  }
});

app.get('/accommodations/:listingId', async (req, res) => {
  try {
    const { listingId } = req.params;
    const {
      checkin,
      checkout,
      adults = 1,
      children = 0,
      infants = 0,
      pets = 0
    } = req.query;

    const airbnbResponse = await axios.post(`http://localhost:${process.env.AIRBNB_PORT || 8007}/airbnb_listing_details`, {
      id: listingId,
      checkin,
      checkout,
      adults,
      children,
      infants,
      pets,
      ignoreRobotsText: process.env.IGNORE_ROBOTS_TXT === 'true'
    });

    res.json({
      status: 'success',
      data: airbnbResponse.data
    });
  } catch (error) {
    console.error('Airbnb listing details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch Airbnb listing details',
      details: error.message
    });
  }
});

// Update the TripAdvisor server startup command
const startTripAdvisorServer = () => {
  console.log('Starting TripAdvisor MCP Server...');
  logger.info('Starting TripAdvisor MCP Server...');
  
  // Use python3 directly since we're in Docker with the venv already in PATH
  const tripAdvisorServer = spawn('python3', [
    '-m', 'flask', 'run',
    '--host=0.0.0.0',
    '--port=8006'
  ], {
    env: {
      ...process.env,
      FLASK_APP: 'server.py',
      FLASK_ENV: 'development'
    }
  });
};

// Add a dedicated endpoint to test the Airbnb MCP Server connection
app.get('/test-airbnb-connection', async (req, res) => {
  try {
    const airbnbPort = process.env.AIRBNB_PORT || 8007;
    const response = await axios.get(`http://localhost:${airbnbPort}/health`, { timeout: 5000 });
    res.json({
      status: 'success',
      message: 'Successfully connected to Airbnb MCP Server',
      serverResponse: response.data
    });
  } catch (error) {
    let errorDetails = {
      message: error.message
    };
    
    if (error.response) {
      errorDetails.status = error.response.status;
      errorDetails.data = error.response.data;
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to connect to Airbnb MCP Server',
      error: errorDetails
    });
  }
});
