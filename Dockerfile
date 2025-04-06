FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Install global dependencies
RUN npm install -g exa-mcp-server

# Expose the gateway port
EXPOSE 8000

# Update the CMD to use the correct path
CMD ["node", "index.js"]