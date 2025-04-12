const { createClient } = require('@supabase/supabase-js');
const env = require('./env');
const { createServerLogger } = require('../server-logger');

const logger = createServerLogger('Supabase');

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);

const checkConnection = async () => {
  try {
    const { data, error } = await supabase.from('trips').select('count');
    if (error) throw error;
    return true;
  } catch (error) {
    logger.error('Supabase connection error:', error);
    return false;
  }
};

process.on('SIGTERM', async () => {
  try {
    await supabase.disconnect();
    logger.info('Supabase connection closed');
  } catch (error) {
    logger.error('Error closing Supabase connection:', error);
  }
});

module.exports = {
  supabase,
  checkConnection
};