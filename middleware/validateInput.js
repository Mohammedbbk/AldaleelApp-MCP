const Joi = require('joi');
const { sanitizeInput } = require('../utils/helpers');

const tripSchema = Joi.object({
  destination: Joi.string().required().min(2).max(100),
  days: Joi.number().integer().min(1).max(30).required(),
  budget: Joi.alternatives().try(Joi.number().positive(), Joi.string().min(1)).required(),
  interests: Joi.array().items(Joi.string()).optional(),
  userCountry: Joi.string().optional(),
  travelDates: Joi.string().optional(),
  travelStyle: Joi.string().optional(),
  dietaryRestrictions: Joi.array().items(Joi.string()).optional(),
  specialRequirements: Joi.array().items(Joi.string()).optional(),
  additionalRequirement: Joi.string().optional(),
  transportationPreference: Joi.array().items(Joi.string()).optional(),
  tripPace: Joi.string().optional()
}).unknown(true);

const validateTravelPlanInput = (req, res, next) => {
  const { error } = tripSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error.details[0].message
    });
  }

  const {
    destination,
    days,
    budget,
    interests = [],
    userCountry = '',
    travelDates = '',
    travelStyle = '',
    dietaryRestrictions = []
  } = req.body;

  // Sanitize string inputs
  req.body.destination = sanitizeInput(destination);
  req.body.userCountry = sanitizeInput(userCountry);
  req.body.travelDates = sanitizeInput(travelDates);
  req.body.travelStyle = sanitizeInput(travelStyle);

  // Sanitize budget if it's provided as a string
  if (typeof budget === 'string') {
    req.body.budget = sanitizeInput(budget);
  }

  // Validate arrays
  if (!Array.isArray(interests) || !Array.isArray(dietaryRestrictions)) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Interests and dietary restrictions must be arrays'
    });
  }

  next();
};

module.exports = {
  validateTravelPlanInput
};