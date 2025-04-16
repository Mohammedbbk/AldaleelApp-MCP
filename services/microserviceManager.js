const { exec } = require('child_process');
const axios = require('axios');
const { createServerLogger } = require('../server-logger');
const servers = require('../config/servers.config');
const env = require('../config/env');

const logger = createServerLogger('MicroserviceManager');

// Helper to check if we're in a deployed environment (like Render)
const isDeployedEnvironment = () => {
  return env.NODE_ENV === 'production' && process.env.RENDER === 'true';
};

const waitForServer = async (name, url, defaultTimeout) => {
  const startTime = Date.now();
  const server = servers.find(s => s.name === name);
  const healthPath = server.healthCheckPath || '/health';
  const maxRetries = server.retries || 1;
  const timeout = server.healthCheckTimeout || defaultTimeout;
  const retryInterval = server.retryIntervalMs || 2000; // Use server-specific retry interval or default to 2000ms

  // Determine the URL to check
  // For deployed environments, we might have a remote URL rather than localhost
  const serverUrl = isDeployedEnvironment() && server.remoteUrl ? 
    server.remoteUrl : 
    `http://127.0.0.1:${server.port}`;
  
  const healthCheckUrl = `${serverUrl}${healthPath}`;

  for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
    const elapsed = Date.now() - startTime;
    if (elapsed > timeout) {
      break;
    }
    try {
      logger.info(`Attempting to connect to ${name} at ${healthCheckUrl} (Attempt ${retryCount + 1}/${maxRetries})`);
      const response = await axios.get(healthCheckUrl, {
        timeout: Math.min(5000, retryInterval)
      });
      logger.info(`${name} is ready with status: ${JSON.stringify(response.data)}`);
      console.log(`${name} is ready`);
      return;
    } catch (error) {
      if (error.response) {
        logger.warn(`${name} responded with status ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        logger.warn(`${name} did not respond to request: ${error.message}`);
      } else {
        logger.warn(`Error setting up request to ${name}: ${error.message}`);
      }

      if (retryCount + 1 >= maxRetries) {
        logger.warn(`Max retries (${maxRetries}) reached for ${name}`);
        break;
      }

      logger.info(`Waiting ${retryInterval}ms before retrying ${name}...`);
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }

  const errorMsg = `Timeout waiting for ${name} to be ready at ${healthCheckUrl} after ${maxRetries} attempts within ${timeout}ms`;
  
  // In deployed environments, we might want to continue even if a health check fails
  if (isDeployedEnvironment()) {
    logger.warn(errorMsg + " (continuing despite error in deployed environment)");
    return;
  }
  
  logger.error(errorMsg);
  throw new Error(errorMsg);
};

const startMCPServers = async () => {
  try {
    // In deployed environments (like Render), we may not need to start all microservices
    // as they may be running as separate services
    if (isDeployedEnvironment()) {
      logger.info("Running in deployed environment. External services will not be started locally.");
      
      // Check if VISA_SERVICE_URL and CULTURE_SERVICE_URL are set
      if (env.VISA_SERVICE_URL) {
        logger.info(`Using external visa service at: ${env.VISA_SERVICE_URL}`);
      } else {
        logger.warn("VISA_SERVICE_URL is not set. Visa requirements may not work.");
      }
      
      if (env.CULTURE_SERVICE_URL) {
        logger.info(`Using external culture service at: ${env.CULTURE_SERVICE_URL}`);
      } else {
        logger.warn("CULTURE_SERVICE_URL is not set. Culture insights may not work.");
      }
      
      // Only proceed with health checks for external services if needed
      // Otherwise, we're done here
      if (!process.env.CHECK_EXTERNAL_SERVICES) {
        return;
      }
    }

    // For local development or when we do need to start services, proceed as normal
    for (const server of servers) {
      // Skip starting services that should be external in deployed environments
      if (isDeployedEnvironment() && 
        (server.name === 'Visa Requirements Server' && env.VISA_SERVICE_URL ||
         server.name === 'Culture Insights Server' && env.CULTURE_SERVICE_URL)) {
        logger.info(`Skipping ${server.name} as it appears to be deployed separately`);
        continue;
      }
      
      logger.info(`Starting ${server.name}...`);
      console.log(`Starting ${server.name}...`);
      
      const options = server.env ? { env: { ...process.env, ...server.env } } : {};
      
      if (server.name === 'TripAdvisor MCP Server') {
        logger.info('Note: TripAdvisor MCP Server requires Python 3.10+ to run');
      }
      
      if (server.name === 'Airbnb MCP Server') {
        logger.info('Starting Airbnb MCP Server with options:', JSON.stringify(options));
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
          return;
        }
        if (stderr) {
          logger.warn(`${server.name} Warning: ${stderr}`);
          console.warn(`${server.name} Warning: ${stderr}`);
        }
        logger.info(`${server.name} Output: ${stdout}`);
        console.log(`${server.name} Output: ${stdout}`);
      });
      
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
      
      // Add a fixed delay between starting servers
      const serverStartDelayMs = 2000;
      logger.info(`Waiting ${serverStartDelayMs}ms before starting next server...`);
      await new Promise(resolve => setTimeout(resolve, serverStartDelayMs));
    }

    if (process.env.WAIT_FOR_SERVERS === 'true') {
      console.log('Waiting for servers to initialize...');
      
      for (const server of servers.filter(s => s.port)) {
        // Skip health checks for services that are external in deployed environments
        if (isDeployedEnvironment() && 
          (server.name === 'Visa Requirements Server' && env.VISA_SERVICE_URL ||
           server.name === 'Culture Insights Server' && env.CULTURE_SERVICE_URL)) {
          logger.info(`Skipping health check for ${server.name} as it appears to be deployed separately`);
          continue;
        }
        
        try {
          await waitForServer(server.name, 'http://localhost:' + server.port, 30000);
        } catch (error) {
          logger.error(`Failed to start ${server.name}: ${error.message}`);
          
          if (server.name === 'Airbnb MCP Server') {
            logger.info('Attempting to diagnose Airbnb MCP Server issue...');
            
            exec(`lsof -i :${server.port}`, (error, stdout) => {
              if (error) {
                logger.info(`Port ${server.port} does not appear to be in use by another process`);
              } else {
                logger.error(`Port ${server.port} may be in use by another process:\n${stdout}`);
              }
            });
            
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

module.exports = {
  startMCPServers,
  waitForServer,
  isDeployedEnvironment
};