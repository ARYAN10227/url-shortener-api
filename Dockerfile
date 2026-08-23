FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package metadata first to leverage Docker layer caching
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose API port
EXPOSE 3000

# Set environment variable defaults
ENV NODE_ENV=production

# Command to start the application
CMD ["npm", "start"]
