# Use Node.js 18 slim as the base image
FROM node:18-slim

# Install system dependencies:
# - python3, python3-pip, python3-venv: For the TripAdvisor server (server.py)
# - python3-dev: Might be needed for some pip package builds
# - curl, git: Often useful utilities in build environments (optional)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    curl \
    git \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# --- Node.js Dependencies ---
# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install Node.js dependencies defined in package.json
# Use npm ci for cleaner installs in CI/CD if using package-lock.json
RUN npm install

# --- Install Global Node.js Packages ---
# Install Airbnb MCP Server globally so npx can find/run it reliably
# Alternatively, add "@openbnb/mcp-server-airbnb" to your package.json (devDependencies or dependencies)
# and the 'RUN npm install' above would handle it. Global install is explicit here.
RUN npm install -g @openbnb/mcp-server-airbnb
# Remove Exa server install if it's commented out in your config and not used
# RUN npm install -g exa-mcp-server

# --- Python Dependencies ---
# Copy Python requirements file
COPY requirements.txt ./

# Create Python virtual environment
RUN python3 -m venv /opt/venv
# Add venv bin to PATH for subsequent RUN and CMD commands
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies into the virtual environment
RUN pip3 install --no-cache-dir -r requirements.txt

# --- Application Code ---
# Copy the rest of your application code
# Ensure you have a .dockerignore file to exclude node_modules, .git, logs, .env, etc.
COPY . .

# --- Ports ---
# Expose all ports used by the gateway and microservices
# Adjust if your port list changes
EXPOSE 8000 8001 8004 8005 8006 8007 8008

# --- Runtime Command ---
# Use the NEW entry point: server.js in the root directory
CMD ["node", "server.js"]