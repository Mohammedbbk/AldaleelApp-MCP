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
const { supabase } = require('../config/supabaseClient');
const { createServerLogger } = require('../server-logger');
const logger = createServerLogger('TripService');
class TripService {
    createTrip(tripData) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                // Map budgetLevel or budget string to numeric code
                const levelMap = { Economy: 1, Moderate: 2, Luxury: 3 };
                const rawLevel = (_a = tripData.budgetLevel) !== null && _a !== void 0 ? _a : tripData.budget;
                const numericBudget = (_b = levelMap[rawLevel]) !== null && _b !== void 0 ? _b : (typeof tripData.budget === 'number' ? tripData.budget : null);
                // Prepare data object for insertion with numeric budget
                const dataToInsert = Object.assign(Object.assign({}, tripData), { budget: numericBudget });
                const { data, error } = yield supabase
                    .from('trips')
                    .insert([dataToInsert]);
                if (error)
                    throw error;
                return data;
            }
            catch (error) {
                logger.error('Error creating trip:', error);
                throw error;
            }
        });
    }
    getTripById(tripId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { data, error } = yield supabase
                    .from('trips')
                    .select('*')
                    .eq('id', tripId)
                    .single();
                if (error) {
                    if (error.code === 'PGRST116') {
                        return null;
                    }
                    throw error;
                }
                return data;
            }
            catch (error) {
                logger.error('Error getting trip:', error);
                throw error;
            }
        });
    }
    getTrips() {
        return __awaiter(this, arguments, void 0, function* (page = 1, limit = 10) {
            try {
                const { data, count, error } = yield supabase
                    .from('trips')
                    .select('*', { count: 'exact' })
                    .range((page - 1) * limit, page * limit - 1);
                if (error)
                    throw error;
                return {
                    data,
                    pagination: {
                        current: page,
                        total: Math.ceil(count / limit),
                        perPage: limit
                    }
                };
            }
            catch (error) {
                logger.error('Error getting trips:', error);
                throw error;
            }
        });
    }
    updateTrip(tripId, newData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { data, error } = yield supabase.rpc('update_trip_with_lock', {
                    p_trip_id: tripId,
                    p_new_data: newData
                });
                if (error)
                    throw error;
                return data;
            }
            catch (error) {
                logger.error('Error updating trip:', error);
                throw error;
            }
        });
    }
}
module.exports = new TripService();
