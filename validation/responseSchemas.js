const Joi = require('joi');

const baseResponseSchema = Joi.object({
  status: Joi.string().valid('success', 'error').required(),
  timestamp: Joi.string().isoDate().required(),
  requestId: Joi.string().uuid().required()
});

const errorResponseSchema = baseResponseSchema.keys({
  status: Joi.string().valid('error').required(),
  code: Joi.string().required(),
  message: Joi.string().required(),
  details: Joi.string(),
  recoverySteps: Joi.array().items(Joi.string()),
  retryAfter: Joi.number().integer().min(0)
});

const successMetadataSchema = Joi.object({
  processingTime: Joi.number().integer().min(0),
  source: Joi.string(),
  cached: Joi.boolean()
});

const chatMessageSchema = Joi.object({
  role: Joi.string().valid('user', 'assistant', 'system').required(),
  content: Joi.string().required(),
  timestamp: Joi.string().isoDate().required(),
  metadata: Joi.object({
    confidence: Joi.number().min(0).max(1),
    sources: Joi.array().items(Joi.string()),
    context: Joi.string(),
    type: Joi.string()
  })
});

const chatConversationSchema = Joi.object({
  id: Joi.string().uuid().required(),
  context: Joi.string(),
  summary: Joi.string()
});

const chatResponseSchema = baseResponseSchema.keys({
  status: Joi.string().valid('success').required(),
  data: Joi.object({
    message: chatMessageSchema.required(),
    conversation: chatConversationSchema.required()
  }).required(),
  metadata: successMetadataSchema
});

const tripActivitySchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  type: Joi.string().required(),
  startTime: Joi.string(),
  endTime: Joi.string(),
  location: Joi.string(),
  cost: Joi.string(),
  description: Joi.string(),
  recommendations: Joi.array().items(Joi.string())
});

const tripMealSchema = Joi.object({
  type: Joi.string().valid('breakfast', 'lunch', 'dinner', 'snack').required(),
  venue: Joi.string(),
  cuisine: Joi.string(),
  cost: Joi.string(),
  dietaryOptions: Joi.array().items(Joi.string())
});

const tripAccommodationSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().required(),
  location: Joi.string().required(),
  checkIn: Joi.string(),
  checkOut: Joi.string(),
  cost: Joi.string(),
  amenities: Joi.array().items(Joi.string())
});

const tripItineraryDaySchema = Joi.object({
  day: Joi.number().integer().min(1).required(),
  date: Joi.string(),
  activities: Joi.array().items(tripActivitySchema).required(),
  meals: Joi.array().items(tripMealSchema),
  accommodation: tripAccommodationSchema,
  notes: Joi.array().items(Joi.string())
});

const tripPlanSchema = Joi.object({
  id: Joi.string().uuid().required(),
  destination: Joi.string().required(),
  days: Joi.number().integer().min(1).required(),
  budget: Joi.string().required(),
  interests: Joi.array().items(Joi.string()).required(),
  userCountry: Joi.string().allow(''),
  travelDates: Joi.string().allow(''),
  travelStyle: Joi.string().allow(''),
  dietaryRestrictions: Joi.array().items(Joi.string()),
  itinerary: Joi.array().items(tripItineraryDaySchema).required(),
  createdAt: Joi.string().isoDate().required(),
  updatedAt: Joi.string().isoDate()
});

const tripPlanResponseSchema = baseResponseSchema.keys({
  status: Joi.string().valid('success').required(),
  data: Joi.object({
    tripId: Joi.string().uuid().required(),
    itinerary: Joi.array().items(tripItineraryDaySchema).required()
  }).required(),
  metadata: successMetadataSchema
});

const tripListResponseSchema = baseResponseSchema.keys({
  status: Joi.string().valid('success').required(),
  data: Joi.object({
    trips: Joi.array().items(tripPlanSchema).required(),
    pagination: Joi.object({
      page: Joi.number().integer().min(1).required(),
      limit: Joi.number().integer().min(1).required(),
      total: Joi.number().integer().min(0).required(),
      pages: Joi.number().integer().min(0).required()
    }).required()
  }).required(),
  metadata: successMetadataSchema
});

module.exports = {
  errorResponseSchema,
  chatResponseSchema,
  tripPlanResponseSchema,
  tripListResponseSchema
}; 