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
const { createServerLogger } = require('../server-logger');
const supabase = require('../config/supabaseClient');
const logger = createServerLogger('Helpers');
// Sanitize input to prevent XSS and other injection attacks
function sanitizeInput(input) {
    if (typeof input === 'string') {
        // Remove HTML tags and special characters
        return input
            .replace(/<[^>]*>/g, '')
            .replace(/[\u00A0-\u9999<>\&]/gim, (i) => `&#${i.charCodeAt(0)};`)
            .trim();
    }
    else if (Array.isArray(input)) {
        return input.map(item => sanitizeInput(item));
    }
    else if (typeof input === 'object' && input !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(input)) {
            sanitized[key] = sanitizeInput(value);
        }
        return sanitized;
    }
    return input;
}
// Check Supabase connection status
function checkSupabaseConnection() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            logger.info('Checking Supabase connection...');
            const { data, error } = yield supabase.from('trips').select('id').limit(1);
            if (error) {
                logger.error('Supabase connection error:', error);
                return false;
            }
            logger.info('Supabase connection successful');
            return true;
        }
        catch (error) {
            logger.error('Failed to check Supabase connection:', error);
            return false;
        }
    });
}
module.exports = {
    sanitizeInput,
    checkSupabaseConnection
};
