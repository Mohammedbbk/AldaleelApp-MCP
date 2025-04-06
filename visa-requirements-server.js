const express = require('express');
// const axios = require('axios'); // Commented out as we'll use Brave MCP instead
const cors = require('cors');
const dotenv = require('dotenv');
const { createServerLogger } = require('./server-logger');
const axios = require('axios'); // Still needed for Brave MCP requests

dotenv.config();
const app = express();
const logger = createServerLogger('visa-requirements');

app.use(cors());
app.use(express.json());

// Commented out Sherpa API configuration
// const SHERPA_API_KEY = process.env.SHERPA_API_KEY;
// const SHERPA_API_URL = 'https://requirements-api.sherpa.com/v2';

// Brave MCP configuration
const BRAVE_MCP_URL = process.env.BRAVE_MCP_URL || 'http://localhost:8000';

// Commented out original implementation
/*
async function getVisaRequirements(nationality, destination) {
  try {
    const response = await axios.get(`${SHERPA_API_URL}/travel-requirements`, {
      params: {
        nationality,
        destination,
        type: 'PROCEDURE',
        categories: ['VISA', 'NO_VISA', 'DOC_REQUIRED'],
      },
      headers: {
        'x-api-key': SHERPA_API_KEY,
      },
    });

    return response.data;
  } catch (error) {
    logger.error('Error fetching visa requirements:', error);
    throw error;
  }
}
*/

// New implementation using Brave MCP
async function getVisaRequirements(nationality, destination) {
  try {
    const response = await axios.post(`${BRAVE_MCP_URL}/api/chat`, {
      messages: [
        {
          role: 'user',
          content: `What are the visa requirements for a ${nationality} citizen traveling to ${destination}? Please provide detailed information about visa types, required documents, length of stay, and any other relevant travel requirements.`
        }
      ],
      stream: false
    });

    return response.data;
  } catch (error) {
    logger.error('Error fetching visa requirements from Brave MCP:', error);
    throw error;
  }
}

app.post('/visa-requirements', async (req, res) => {
  try {
    const { nationality, destination } = req.body;
    
    if (!nationality || !destination) {
      return res.status(400).json({
        error: 'Missing required parameters: nationality and destination'
      });
    }

    const braveResponse = await getVisaRequirements(nationality, destination);
    
    // Format data from Brave MCP response
    const formattedData = {
      visaRequirements: {
        content: braveResponse.message?.content || "No information available",
        source: "Brave MCP"
      }
    };

    res.json(formattedData);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch visa requirements',
      details: error.message
    });
  }
});

const PORT = process.env.VISA_REQUIREMENTS_PORT || 8007;
app.listen(PORT, () => {
  logger.info(`Visa Requirements MCP Server running on port ${PORT}`);
});