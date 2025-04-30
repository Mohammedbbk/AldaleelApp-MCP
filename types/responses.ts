// Response status types
export type ResponseStatus = 'success' | 'error';

// Base response interface
export interface BaseResponse {
  status: ResponseStatus;
  timestamp: string;
  requestId: string;
}

// Error response interface
export interface ErrorResponse extends BaseResponse {
  status: 'error';
  code: string;
  message: string;
  details?: string;
  recoverySteps?: string[];
  retryAfter?: number;
}

// Success response interface
export interface SuccessResponse<T> extends BaseResponse {
  status: 'success';
  data: T;
  metadata?: {
    processingTime?: number;
    source?: string;
    cached?: boolean;
  };
}

// AI Chat specific types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    confidence?: number;
    sources?: string[];
    context?: string;
  };
}

export interface ChatResponse {
  messages: ChatMessage[];
  conversation: {
    id: string;
    context?: string;
    summary?: string;
  };
}

// Trip planning specific types
export interface TripPlan {
  id: string;
  destination: string;
  days: number;
  budget: string;
  interests: string[];
  userCountry?: string;
  travelDates?: string;
  travelStyle?: string;
  dietaryRestrictions?: string[];
  itinerary: TripItineraryDay[];
  createdAt: string;
  updatedAt?: string;
}

export interface TripItineraryDay {
  day: number;
  date?: string;
  activities: TripActivity[];
  meals?: TripMeal[];
  accommodation?: TripAccommodation;
  notes?: string[];
}

export interface TripActivity {
  id: string;
  name: string;
  type: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  cost?: string;
  description?: string;
  recommendations?: string[];
}

export interface TripMeal {
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  venue?: string;
  cuisine?: string;
  cost?: string;
  dietaryOptions?: string[];
}

export interface TripAccommodation {
  name: string;
  type: string;
  location: string;
  checkIn?: string;
  checkOut?: string;
  cost?: string;
  amenities?: string[];
} 