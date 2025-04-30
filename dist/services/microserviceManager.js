"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const { exec } = require('child_process');
const axios = require('axios');
const { createServerLogger } = require('../server-logger');
const servers = require('../config/servers.config');
const env = require('../config/env');
const logger = createServerLogger('MicroserviceManager');
// Helper to check if we're in a deployed environment (like Render)
const isDeployedEnvironment = () => {
    // Explicitly check RENDER env var as well for more certainty
    return env.NODE_ENV === 'production' || process.env.RENDER === 'true';
};
const waitForServer = (name, url, defaultTimeout) => __awaiter(void 0, void 0, void 0, function* () {
    const startTime = Date.now();
    const server = servers.find(s => s.name === name);
    if (!server) {
        logger.warn(`[waitForServer] Configuration for server '${name}' not found.`);
        return; // Cannot wait for a server that's not configured
    }
    const healthPath = server.healthCheckPath || '/health';
    const maxRetries = server.retries || 1;
    const timeout = server.healthCheckTimeout || defaultTimeout;
    const retryInterval = server.retryIntervalMs || 2000;
    // Determine the URL to check
    // For deployed environments where SERVICE_URLs are NOT set, we still check localhost internally
    const serverUrl = `http://127.0.0.1:${server.port}`;
    const healthCheckUrl = `${serverUrl}${healthPath}`;
    logger.info(`[waitForServer] Starting health check for ${name} at ${healthCheckUrl}`);
    for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
        const elapsed = Date.now() - startTime;
        if (elapsed > timeout) {
            break;
        }
        try {
            logger.info(`[waitForServer] Attempting to connect to ${name} at ${healthCheckUrl} (Attempt ${retryCount + 1}/${maxRetries})`);
            const response = yield axios.get(healthCheckUrl, {
                timeout: Math.min(5000, retryInterval)
            });
            logger.info(`[waitForServer] ${name} is ready with status: ${JSON.stringify(response.data)}`);
            console.log(`[waitForServer] ${name} is ready.`); // Keep console log
            return;
        }
        catch (error) {
            if (error.response) {
                logger.warn(`[waitForServer] ${name} responded with status ${error.response.status}: ${JSON.stringify(error.response.data)}`);
            }
            else if (error.request) {
                logger.warn(`[waitForServer] ${name} did not respond to request: ${error.message}`);
            }
            else {
                logger.warn(`[waitForServer] Error setting up request to ${name}: ${error.message}`);
            }
            if (retryCount + 1 >= maxRetries) {
                logger.warn(`[waitForServer] Max retries (${maxRetries}) reached for ${name}`);
                break;
            }
            logger.info(`[waitForServer] Waiting ${retryInterval}ms before retrying ${name}...`);
            yield new Promise(resolve => setTimeout(resolve, retryInterval));
        }
    }
    const errorMsg = `[waitForServer] Timeout waiting for ${name} to be ready at ${healthCheckUrl} after ${maxRetries} attempts within ${timeout}ms`;
    // Log error but don't throw in deployed environment to avoid crashing gateway
    // if a non-critical internal service fails to start
    if (isDeployedEnvironment()) {
        logger.error(errorMsg + " (Continuing despite error in deployed environment)");
        return;
    }
    logger.error(errorMsg);
    throw new Error(errorMsg);
});
const startMCPServers = () => __awaiter(void 0, void 0, void 0, function* () {
    logger.info('[startMCPServers] Starting execution...'); // Log entry
    try {
        // In deployed environments (like Render), we only start services if their external URL is NOT provided.
        // This allows deploying some as separate services and some internally.
        const deployed = isDeployedEnvironment();
        logger.info(`[startMCPServers] Running in ${deployed ? 'deployed' : 'local'} environment.`);
        for (const server of servers) {
            logger.info(`[startMCPServers] Processing server config: ${server.name}`);
            // Determine if this service should be started internally
            let shouldStartInternally = true;
            if (deployed) {
                if (server.name === 'Visa Requirements Server' && env.VISA_SERVICE_URL) {
                    logger.info(`[startMCPServers] Skipping internal start for ${server.name} - VISA_SERVICE_URL is set.`);
                    shouldStartInternally = false;
                }
                if (server.name === 'Culture Insights Server' && env.CULTURE_SERVICE_URL) {
                    logger.info(`[startMCPServers] Skipping internal start for ${server.name} - CULTURE_SERVICE_URL is set.`);
                    shouldStartInternally = false;
                }
                // Add similar checks here if other services might be deployed externally
            }
            if (!shouldStartInternally) {
                continue; // Move to the next server config
            }
            logger.info(`[startMCPServers] Attempting to start ${server.name} internally...`);
            console.log(`[startMCPServers] Starting ${server.name}...`); // Keep console log
            const options = server.env ? { env: Object.assign(Object.assign({}, process.env), server.env) } : {};
            logger.info(`[startMCPServers] Options for ${server.name}: ${JSON.stringify(options)}`); // Log options
            logger.info(`[startMCPServers] Command for ${server.name}: ${server.command}`); // Log command
            // Check if the command file exists (for Node scripts)
            if (server.command.startsWith('node')) {
                const scriptPathMatch = server.command.match(/node\s+([^\s]+)/);
                if (scriptPathMatch && scriptPathMatch[1]) {
                    const scriptPath = scriptPathMatch[1];
                    try {
                        require.resolve(scriptPath); // Check if Node can find the script
                        logger.info(`[startMCPServers] Script found for ${server.name}: ${scriptPath}`);
                    }
                    catch (resolveError) {
                        logger.error(`[startMCPServers] CRITICAL: Script not found for ${server.name} at ${scriptPath}. Cannot start. Error: ${resolveError.message}`);
                        continue; // Skip this server if script is missing
                    }
                }
            }
            // Execute the command
            const childProcess = exec(server.command, options, (error, stdout, stderr) => {
                // This callback runs AFTER the process exits
                if (error) {
                    logger.error(`[startMCPServers] ${server.name} exited with error: ${error.message}`);
                    console.error(`[startMCPServers] ${server.name} Error: ${error.message}`);
                    return;
                }
                if (stderr) {
                    // Log stderr as warning, it might contain important info even on success
                    logger.warn(`[startMCPServers] ${server.name} stderr output: ${stderr}`);
                    console.warn(`[startMCPServers] ${server.name} stderr: ${stderr}`);
                }
                logger.info(`[startMCPServers] ${server.name} stdout output (on exit): ${stdout}`);
                console.log(`[startMCPServers] ${server.name} stdout (on exit): ${stdout}`);
            });
            // Log immediately that the process was spawned
            logger.info(`[startMCPServers] Spawned process for ${server.name} with PID: ${childProcess.pid}`);
            // Log stdout/stderr streams in real-time
            childProcess.stdout.on('data', (data) => logger.info(`[${server.name} STDOUT]: ${data.toString().trim()}`));
            childProcess.stderr.on('data', (data) => logger.warn(`[${server.name} STDERR]: ${data.toString().trim()}`));
            // Add a fixed delay between starting servers
            const serverStartDelayMs = 2000;
            logger.info(`[startMCPServers] Waiting ${serverStartDelayMs}ms before starting next server...`);
            yield new Promise(resolve => setTimeout(resolve, serverStartDelayMs));
        }
        // Wait for servers only if WAIT_FOR_SERVERS is true
        if (env.WAIT_FOR_SERVERS) {
            logger.info('[startMCPServers] WAIT_FOR_SERVERS is true. Starting health checks...');
            console.log('[startMCPServers] Waiting for servers to initialize...');
            const healthCheckPromises = servers
                .filter(server => {
                // Only check servers that are supposed to be internal
                let shouldCheck = true;
                if (deployed) {
                    if (server.name === 'Visa Requirements Server' && env.VISA_SERVICE_URL)
                        shouldCheck = false;
                    if (server.name === 'Culture Insights Server' && env.CULTURE_SERVICE_URL)
                        shouldCheck = false;
                    // Add similar checks for other potentially external services
                }
                return shouldCheck && server.port && server.healthCheckPath; // Ensure port and health check path are defined
            })
                .map(server => {
                logger.info(`[startMCPServers] Queuing health check for internally started server: ${server.name}`);
                // Use the correct internal URL for health check
                return waitForServer(server.name, `http://localhost:${server.port}`, server.healthCheckTimeout || 30000);
            });
            yield Promise.allSettled(healthCheckPromises).then(results => {
                results.forEach((result, index) => {
                    var _a;
                    // Find corresponding server config to log name
                    const checkedServer = servers.filter(s => {
                        let shouldCheck = true;
                        if (deployed) {
                            if (s.name === 'Visa Requirements Server' && env.VISA_SERVICE_URL)
                                shouldCheck = false;
                            if (s.name === 'Culture Insights Server' && env.CULTURE_SERVICE_URL)
                                shouldCheck = false;
                        }
                        return shouldCheck && s.port && s.healthCheckPath;
                    })[index];
                    if (result.status === 'rejected') {
                        logger.error(`[startMCPServers] Health check failed for ${(checkedServer === null || checkedServer === void 0 ? void 0 : checkedServer.name) || 'Unknown Server'}: ${((_a = result.reason) === null || _a === void 0 ? void 0 : _a.message) || result.reason}`);
                    }
                    else {
                        logger.info(`[startMCPServers] Health check successful for ${(checkedServer === null || checkedServer === void 0 ? void 0 : checkedServer.name) || 'Unknown Server'}.`);
                    }
                });
            });
            logger.info('[startMCPServers] All health checks completed.');
        }
        else {
            logger.info('[startMCPServers] WAIT_FOR_SERVERS is false. Skipping health checks.');
        }
        logger.info('[startMCPServers] Finished execution.');
    }
    catch (error) {
        logger.error('[startMCPServers] Uncaught error during execution:', error);
        console.error('[startMCPServers] Error starting MCP servers:', error);
        // Optionally re-throw or handle critical failure
    }
});
module.exports = {
    startMCPServers,
    waitForServer,
    isDeployedEnvironment
};
