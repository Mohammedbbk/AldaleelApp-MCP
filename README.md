# Aldaleel MCP - AI Travel Assistant
An AI-powered travel assistant application leveraging multiple Model Context Protocol (MCP) servers to provide comprehensive and personalized travel planning capabilities.

## Overview

Aldaleel MCP acts as the backend powerhouse for the Aldaleel AI Travel Assistant. It integrates various data sources and AI models through a microservices architecture, orchestrated by a central gateway. This allows for modularity, scalability, and easy integration of new travel-related services.

## Features

- **AI-Powered Itinerary Generation:** Creates personalized travel plans based on user preferences (destination, duration, budget, interests, etc.).
- **Real-time Mapping:** Integrates with mapping services (like Google Maps via the Travel Planner MCP) for location data and visualization.
- **Live Event Information:** Fetches up-to-date event data from sources like Ticketmaster.
- **Accommodation & Attraction Data:** Accesses comprehensive information on hotels, restaurants, and attractions from TripAdvisor.
- **Visa Requirement Checks:** Provides information on visa requirements based on user nationality and destination (if the Visa Requirements MCP is enabled).
- **Centralized API Gateway:** Single entry point for all backend services.
- **Microservice Architecture:** Each core functionality (AI, Maps, Events, etc.) runs as a separate MCP server.

## Architecture

This application follows a microservices pattern:

- **Gateway Server (`gateway/index.js`):** An Express.js application serving as the main API entry point. It routes requests to the appropriate MCP server and aggregates responses.
- **MCP Servers:** Specialized Node.js or Python services handling specific tasks:
    - **AI Itinerary Generator (`openai-server.js`):** Leverages OpenAI models for core travel planning.
    - **Travel Planner (`mapbox-travel-planner.js`):** Integrates with mapping services (Note: Filename suggests Mapbox, README previously mentioned Google Maps - clarification might be needed).
    - **Live Events (`live-events-server.js`):** Connects to the Ticketmaster API.
    - **TripAdvisor (`server.py`):** Interfaces with the TripAdvisor API (requires Python environment).
    - **Visa Requirements (`visa-requirements-server.js`):** Provides visa information.
- **Frontend:** A separate React application (`../AldaleelApp`) interacts with this backend via the Gateway API.

## Setup

### Prerequisites

- Node.js v18 or higher
- npm (usually comes with Node.js)
- Python 3.13+ (Required *only* for the TripAdvisor MCP Server)
- `uv` Python package manager (Required *only* for the TripAdvisor MCP Server)

### Environment Variables

Configuration is managed via environment variables. Copy the example file and populate it with your API keys and credentials:

```bash
cp gateway/.env.example .env 
# Or potentially cp .env.example .env if the example is in the root
```

**Required Variables:**

- `OPENAI_API_KEY`: Your OpenAI API key.
- `GOOGLE_MAPS_API_KEY`: Your Google Maps API key (or relevant key for the mapping service used).
- `TICKETMASTER_API_KEY`: Your Ticketmaster API key.
- `TRIPADVISOR_API_KEY`: Your TripAdvisor API key.
- `SUPABASE_URL`: Your Supabase project URL.
- `SUPABASE_KEY`: Your Supabase public anon key.
- `PORT`: Port for the gateway server (defaults if not set).
- *(Potentially others - check `.env.example`)*

### Installation

1.  **Install Node.js dependencies:**
    ```bash
    npm install
    ```

2.  **Set up TripAdvisor Server (Optional):**
    If you intend to run the TripAdvisor MCP server, navigate to the `AldaleelMCP` directory (if not already there) and set up its Python environment:
    ```bash
    # Create a virtual environment
    uv venv

    # Activate the environment (example for bash/zsh)
    source .venv/bin/activate 

    # Install Python dependencies
    uv sync
    ```
    *Note: Remember to activate the virtual environment (`source .venv/bin/activate`) whenever you need to run or work with the Python server.* 

### Running the Application

Start the gateway and all configured MCP servers:

```bash
npm start
```

This command typically runs the `server.js` script, which manages the startup of the gateway and the individual MCP processes.

## API Endpoints

All endpoints are accessed through the Gateway server.

- **`GET /health`**
  - **Description:** Checks the health status of the gateway and potentially connected MCP servers.
  - **Response:** `200 OK` with status information.

- **`POST /generate`**
  - **Description:** Generates a travel itinerary based on user input.
  - **Request Body:**
    ```json
    {
      "destination": "Paris, France",
      "days": 5,
      "budget": 2000,
      "interests": ["art", "history", "food"],
      "userCountry": "United States", 
      "travelDates": "June 10-15, 2024",
      "travelStyle": "luxury", // e.g., budget, mid-range, luxury
      "dietaryRestrictions": ["vegetarian"]
      // Add any other relevant parameters supported by the AI service
    }
    ```
  - **Response:** `200 OK` with the generated travel plan (JSON format).

*(Add other relevant endpoints like those potentially defined in `routes/` if applicable)*

## Contributing

Contributions are welcome! Please follow standard fork-and-pull-request workflows. Ensure code style consistency and add tests for new features.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details (assuming a LICENSE file exists or will be added).