require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createServerLogger } = require('./server-logger'); 

const PORT = process.env.CULTURE_INSIGHTS_PORT || 8008; 
const LLM_SERVICE_URL = process.env.BRAVE_MCP_URL || `http://localhost:${process.env.BRAVE_PORT || 8010}`;
const LLM_API_ENDPOINT = process.env.BRAVE_API_ENDPOINT || '/api/chat';
const REQUEST_TIMEOUT = parseInt(process.env.CULTURE_REQUEST_TIMEOUT) || 30000; 

const app = express();

const logger = createServerLogger('CultureInsights');

app.use(cors()); 
app.use(express.json()); 

async function getCultureInsightsFromLLM(nationality, destination) {
  const targetUrl = `${LLM_SERVICE_URL}${LLM_API_ENDPOINT}`;
  logger.info(`Querying LLM at ${targetUrl} for culture insights: ${nationality} -> ${destination}`);

  const payload = {
    messages: [
      {
        role: 'user',
        content: `Provide cultural insights for a ${nationality} citizen traveling to ${destination === 'SA' ? 'Saudi Arabia' : destination}. Focus on:
1.  **Greetings & Etiquette:** Common greetings, addressing people (formal/informal), gestures to use/avoid.
2.  **Social Norms:** Tipping customs, gift-giving practices, punctuality expectations, public behavior.
3.  **Communication:** Direct vs. indirect communication styles, sensitive topics to avoid.
4.  **Food & Dining:** Meal etiquette, common local dishes, dietary considerations (if any specific to the destination).
5.  **Key Phrases:** A few essential phrases in the local language (e.g., hello, thank you, excuse me).
6.  **Important Note:** Any critical cultural aspect a visitor should be aware of to avoid misunderstandings or offense.`
      }
    ]
  };

  try {
    logger.info(`[getCultureInsightsFromLLM] >>> Preparing to POST to ${targetUrl}`, { payload: JSON.stringify(payload) });
    const response = await axios.post(
      targetUrl,
      payload,
      { timeout: REQUEST_TIMEOUT }
    );
    logger.info(`[getCultureInsightsFromLLM] <<< Successfully received response from ${targetUrl}`, { status: response.status });

    const content = response.data?.choices?.[0]?.message?.content 
                 || response.data?.message?.content          
                 || response.data?.content                     
                 || JSON.stringify(response.data);          

    if (!content || content === '{}' || content === '""') {
        logger.warn(`LLM returned empty or invalid content for culture insights: ${nationality} -> ${destination}`);
        return "Cultural information service did not provide specific details.";
    }
    logger.info(`Successfully received culture insights from LLM for ${nationality} -> ${destination}`);
    return content.trim();

  } catch (error) {
    const status = error.response?.status;
    const errorData = error.response?.data;
    const errorCode = error.code; 
    logger.error(`[getCultureInsightsFromLLM] !!! Error calling LLM (${targetUrl}): ${error.message}`, { status, errorCode, errorData: JSON.stringify(errorData) });
    if (errorCode === 'ECONNREFUSED') {
       throw new Error(`LLM service connection refused at ${targetUrl}`);
    } else if (errorCode === 'ETIMEDOUT') {
       throw new Error(`LLM service request timed out at ${targetUrl}`);
    } else {
       throw new Error(`LLM service request failed with status ${status || 'unknown'} (Code: ${errorCode || 'N/A'})`);
    }
  }
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'culture-insights-service' });
});

app.post('/cultural-insights', async (req, res, next) => {
  logger.info('>>> POST /cultural-insights HANDLER REACHED <<<', { body: req.body });
  const { nationality, destination } = req.body;

  if (!nationality || !destination || typeof nationality !== 'string' || typeof destination !== 'string') {
    logger.warn('Invalid request to /cultural-insights: Missing or invalid params', { body: req.body });
    return res.status(400).json({
      status: 'error',
      message: 'Parameters "nationality" and "destination" (strings) are required.',
    });
  }

  try {
    logger.info(`[POST /cultural-insights] ---> Calling getCultureInsightsFromLLM for ${nationality} -> ${destination}`);
    const cultureContent = await getCultureInsightsFromLLM(nationality, destination);
    logger.info(`[POST /cultural-insights] <--- Received content from LLM. Length: ${cultureContent?.length || 0}`);

    function parseCultureInsights(rawContent) {
      const insights = {};
      let successfullyParsedSomething = false;
    
      // Define sections: key is what frontend expects, 
      // promptKeyword is the main term in the LLM prompt's section title.
      const sectionDefinitions = [
        { key: "etiquette", promptKeyword: "Greetings & Etiquette" },
        { key: "communication", promptKeyword: "Communication" },
        { key: "socialNorms", promptKeyword: "Social Norms" },
        { key: "foodAndDining", promptKeyword: "Food & Dining" },
        { key: "keyPhrases", promptKeyword: "Key Phrases" },
        { key: "notes", promptKeyword: "Important Note" }
      ];
    
      // Ensure all expected keys are initialized so they appear in the final object
      sectionDefinitions.forEach(def => {
        insights[def.key] = ""; 
      });
    
      for (const def of sectionDefinitions) {
        // Same regex pattern logic as before
        const nextSectionPattern = sectionDefinitions
          .map(s => s.promptKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&'))
          .join('|');
    
        const regex = new RegExp(
          `(?:\\d+\\.\\s*)?(?:\\*\\*)?${def.promptKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&')}(?:\\*\\*)?:\\s*([\\s\\S]*?)(?=\\n\\s*(?:\\d+\\.\\s*)?(?:\\*\\*)?(?:${nextSectionPattern})(?:\\*\\*)?:|$)`,
          "i"
        );
    
        const match = regex.exec(rawContent);
        if (match && match[1] && match[1].trim()) {
          insights[def.key] = match[1].trim();
          successfullyParsedSomething = true;
        }
      }
    
      if (successfullyParsedSomething) {
        // Also provide the customs property which is expected by the UI
        if (!insights.customs) {
          // If no customs property exists, use the etiquette content as fallback
          // This ensures compatibility with UI code that looks for data.customs
          insights.customs = insights.etiquette || Object.values(insights).find(value => value) || "";
        }
        return insights;
      }
    
      logger.warn(`[parseCultureInsights] Failed to parse specific cultural insight sections. Raw content preview: ${rawContent.substring(0, 200)}`);
      return { content: rawContent.trim() }; // Fallback to raw content
    }

    const structured = parseCultureInsights(cultureContent);
    logger.info('[POST /cultural-insights] Sending success response.');
    res.json({
      status: 'success',
      culturalInsights: structured.content || structured
    });
  } catch (error) {
    logger.error(`[POST /cultural-insights] !!! Error caught in route handler: ${error.message}`);
    res.status(502).json({
      status: 'error',
      message: 'Failed to retrieve culture insights from the information service.',
      details: error.message 
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Culture Insights Server started successfully on port ${PORT}`);
  logger.info(`Configured to query LLM at: ${LLM_SERVICE_URL}${LLM_API_ENDPOINT}`);
});