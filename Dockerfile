# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install production dependencies in the container
# This ensures native modules are built for the correct architecture
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source
COPY server.js ./
COPY generate-password.js ./
COPY public ./public

# Expose port 3000
EXPOSE 3000

# Run as non-root user for security
USER node

# Start the application
CMD ["node", "server.js"]
