// Gateway entry point for deployment
const path = require('path');

// Import the main server application
const serverPath = path.join(__dirname, '..', 'server.js');
require(serverPath);