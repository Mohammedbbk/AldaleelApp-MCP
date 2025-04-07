const Joi = require('joi');

const tripSchema = Joi.object({
  destination: Joi.string().required(),
  status: Joi.string().valid('upcoming', 'planning', 'completed').required(),
  duration: Joi.string().required(),
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().required(),
  thumbnail: Joi.string().uri().optional()
});

const validateSchema = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.details[0].message
      });
    }
    
    next();
  };
};

module.exports = {
  validateTrip: validateSchema(tripSchema),
  tripSchema
};