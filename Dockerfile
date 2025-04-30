FROM node:18-slim

# Install Python etc. (Keeping as is)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    curl \
    git \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

# Install ALL dependencies (including devDependencies needed for build)
RUN npm install

# --- Optional: Setup Python Environment ---
# (Keep if the Python TripAdvisor service is used)
COPY requirements.txt ./
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip3 install --no-cache-dir -r requirements.txt
# --- End Optional Python Setup ---

# Copy the rest of the application source code (.ts, .js, etc.)
COPY . .

# ---> Compile TypeScript code <---
# This will create the 'dist' directory with compiled JS files
RUN npm run build

# ---> Optional: Prune devDependencies after build <---
# If you want a smaller final image, uncomment the next line
# RUN npm prune --production

# Expose necessary ports
EXPOSE 8000 8001 8004 8005 8006 8007 8008 8009 3002 8010

# ---> ADJUST CMD TO RUN FROM 'dist' DIRECTORY <---
# Run the compiled server entry point
CMD ["node", "dist/server.js"]