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
const { createClient } = require('@supabase/supabase-js');
const env = require('./env');
const { createServerLogger } = require('../server-logger');
const logger = createServerLogger('Supabase');
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
const checkConnection = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { data, error } = yield supabase.from('trips').select('count');
        if (error)
            throw error;
        return true;
    }
    catch (error) {
        logger.error('Supabase connection error:', error);
        return false;
    }
});
process.on('SIGTERM', () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield supabase.disconnect();
        logger.info('Supabase connection closed');
    }
    catch (error) {
        logger.error('Error closing Supabase connection:', error);
    }
}));
module.exports = {
    supabase,
    checkConnection
};
