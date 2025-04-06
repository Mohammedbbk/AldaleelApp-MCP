FROM node:18-slim

# Install Python and pip for TripAdvisor server
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Setup Python virtual environment and install requirements
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip3 install --no-cache-dir -r requirements.txt

# Install global dependencies
RUN npm install -g exa-mcp-server

# Expose all required ports
EXPOSE 8000 8001 8002 8004 8005 8006 8007 8008

CMD ["node", "gateway/index.js"]