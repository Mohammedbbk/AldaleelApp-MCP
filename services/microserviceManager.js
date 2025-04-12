const { exec } = require('child_process');
const axios = require('axios');
const { createServerLogger } = require('../server-logger');
const servers = require('../config/servers.config');

const logger = createServerLogger('MicroserviceManager');

const waitForServer = async (name, url, defaultTimeout) => {
  const startTime = Date.now();
  const server = servers.find(s => s.name === name);
  const healthPath = server.healthCheckPath || '/health';
  const maxRetries = server.retries || 1;
  const timeout = server.healthCheckTimeout || defaultTimeout;
  const retryInterval = 2000; // Time between retries in milliseconds
  let retryCount = 0;
  
  while (Date.now() - startTime < timeout) {
    try {
      logger.info(`Attempting to connect to ${name} at ${url}${healthPath} (Attempt ${retryCount + 1}/${maxRetries})`);
      const response = await axios.get(`http://127.0.0.1:${server.port}${healthPath}`, { 
        timeout: Math.min(5000, timeout / maxRetries) // Ensure individual request timeout is reasonable
      });
      logger.info(`${name} is ready with status: ${JSON.stringify(response.data)}`);
      console.log(`${name} is ready`);
      return;
    } catch (error) {
      retryCount++;
      
      if (error.response) {
        logger.warn(`${name} responded with status ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        logger.warn(`${name} did not respond to request: ${error.message}`);
      } else {
        logger.warn(`Error setting up request to ${name}: ${error.message}`);
      }
      
      if (retryCount >= maxRetries) {
        logger.warn(`Max retries (${maxRetries}) reached for ${name}`);
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
  
  const errorMsg = `Timeout waiting for ${name} to be ready at ${url}${healthPath} after ${retryCount} attempts`;
  logger.error(errorMsg);
  throw new Error(errorMsg);
};

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
      
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }

    if (process.env.WAIT_FOR_SERVERS === 'true') {
      console.log('Waiting for servers to initialize...');
      
      for (const server of servers.filter(s => s.port)) {
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
  waitForServer
};