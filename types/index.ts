/**
 * Shared TypeScript types for Aldaleel Travel Application
 */

export type TripStatus = 'upcoming' | 'planning' | 'completed';

export interface Trip {
  id: string;
  destination: string;
  status: TripStatus;
  duration: string;
  startDate: string; 
  endDate: string; 
  thumbnail?: string;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: string;
}

export interface TripListResponse {
  trips: Trip[];
  total: number;
  page: number;
  limit: number;
}

export interface TripCreateRequest {
  destination: string;
  status: TripStatus;
  duration: string;
  startDate: string;
  endDate: string;
  thumbnail?: string;
}

export interface TripUpdateRequest extends Partial<TripCreateRequest> {
  id: string;
}