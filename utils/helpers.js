const { createServerLogger } = require('../server-logger');
const supabase = require('../config/supabaseClient');

const logger = createServerLogger('Helpers');

function sanitizeInput(input) {
  if (typeof input === 'string') {
    return input
      .replace(/<[^>]*>/g, '')
      .replace(/[\u00A0-\u9999<>\&]/gim, (i) => `&#${i.charCodeAt(0)};`)
      .trim();
  } else if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  } else if (typeof input === 'object' && input !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return input;
}

async function checkSupabaseConnection() {
  try {
    logger.info('Checking Supabase connection...');
    const { data, error } = await supabase.from('trips').select('id').limit(1);
    
    if (error) {
      logger.error('Supabase connection error:', error);
      return false;
    }
    
    logger.info('Supabase connection successful');
    return true;
  } catch (error) {
    logger.error('Failed to check Supabase connection:', error);
    return false;
  }
}

module.exports = {
  sanitizeInput,
  checkSupabaseConnection
};