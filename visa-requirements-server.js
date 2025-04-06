const express = require('express');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');
const { createServerLogger } = require('./server-logger');

dotenv.config();
const app = express();
const logger = createServerLogger('visa-requirements');

app.use(cors());
app.use(express.json());

const SHERPA_API_KEY = process.env.SHERPA_API_KEY;
const SHERPA_API_URL = 'https://requirements-api.sherpa.com/v2';

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

app.post('/visa-requirements', async (req, res) => {
  try {
    const { nationality, destination } = req.body;
    
    if (!nationality || !destination) {
      return res.status(400).json({
        error: 'Missing required parameters: nationality and destination'
      });
    }

    const requirements = await getVisaRequirements(nationality, destination);
    
    // Format data for LLM consumption
    const formattedData = {
      visaRequirements: requirements.data.map(req => ({
        type: req.type,
        category: req.category,
        title: req.title,
        description: req.description,
        enforcement: req.enforcement,
        documentTypes: req.documentTypes,
        travelPurposes: req.travelPurposes,
        lengthOfStay: req.lengthOfStay,
        actions: req.actions
      }))
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