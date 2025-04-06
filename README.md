# Aldaleel MCP - AI Travel Assistant

An AI-powered travel assistant application leveraging multiple Model Context Protocol (MCP) servers for enhanced travel planning capabilities.

## Features

- AI Travel Assistant for comprehensive travel planning
- Real-time Google Maps integration via Travel Planner MCP
- Live events data from Ticketmaster
- TripAdvisor data for attractions, restaurants, and hotels

## MCP Servers

This application uses several MCP servers:

1. **AI Itinerary Generator** - Core travel planning capabilities
2. **Travel Planner MCP Server** - Google Maps integration
3. **Live Events MCP Server** - Ticketmaster API integration
4. **TripAdvisor MCP Server** - Access to TripAdvisor data

## Setup

### Prerequisites

- Node.js 18 or higher
- Python 3.13+ (for TripAdvisor MCP Server)
- uv package manager (for TripAdvisor MCP Server)

### Environment Variables

Copy the example environment file and fill in your API keys:

```bash
cp gateway/.env.example .env
```

Required API keys:
- OpenAI API key
- Google Maps API key
- Ticketmaster API key
- TripAdvisor API key
- Supabase credentials

### Installation

Install dependencies:

```bash
npm install
```

To set up the TripAdvisor server (optional):

```bash
uv venv
uv sync
```

### Running the Application

Start the application:

```bash
npm start
```

This will launch the gateway server and all MCP servers.

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /generate` - Generate travel plans

## API Usage

Send a POST request to `/generate` with the following JSON structure:

```json
{
  "destination": "Paris",
  "days": 5,
  "budget": 2000,
  "interests": ["art", "history", "food"],
  "userCountry": "United States",
  "travelDates": "June 10-15, 2024",
  "travelStyle": "luxury",
  "dietaryRestrictions": ["vegetarian"]
}
```

## Architecture

This application follows a microservices architecture:

- Gateway Server (Express.js) - Main entry point
- MCP Servers - Specialized services for different data sources
- Frontend - React application for user interaction 