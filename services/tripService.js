const { supabase } = require('../config/supabaseClient');
const { createServerLogger } = require('../server-logger');

const logger = createServerLogger('TripService');

class TripService {
  async createTrip(tripData) {
    try {
      // Map budgetLevel or budget string to numeric code
      const levelMap = { Economy: 1, Moderate: 2, Luxury: 3 };
      const rawLevel = tripData.budgetLevel ?? tripData.budget;
      const numericBudget = levelMap[rawLevel] ?? (typeof tripData.budget === 'number' ? tripData.budget : null);

      // Prepare data object for insertion with numeric budget
      const dataToInsert = { ...tripData, budget: numericBudget };

      const { data, error } = await supabase
        .from('trips')
        .insert([dataToInsert]);

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating trip:', error);
      throw error;
    }
  }

  async getTripById(tripId) {
    try {
      const { data, error } = await supabase
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
    } catch (error) {
      logger.error('Error getting trip:', error);
      throw error;
    }
  }

  async getTrips(page = 1, limit = 10) {
    try {
      const { data, count, error } = await supabase
        .from('trips')
        .select('*', { count: 'exact' })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;

      return {
        data,
        pagination: {
          current: page,
          total: Math.ceil(count / limit),
          perPage: limit
        }
      };
    } catch (error) {
      logger.error('Error getting trips:', error);
      throw error;
    }
  }

  async updateTrip(tripId, newData) {
    try {
      const { data, error } = await supabase.rpc('update_trip_with_lock', {
        p_trip_id: tripId,
        p_new_data: newData
      });

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error updating trip:', error);
      throw error;
    }
  }
}

module.exports = new TripService();