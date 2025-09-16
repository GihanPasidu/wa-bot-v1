FROM node:18-slim

# Set Node.js environment variables for better compatibility
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Install system dependencies including git
RUN apt-get update && \
    apt-get install -y \
    git \
    ffmpeg \
    imagemagick \
    webp \
    curl \
    python3 \
    make \
    g++ \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy application code
COPY . .

# Create directory for auth data
RUN mkdir -p auth_info

# Expose port
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

# Start the application
CMD ["npm", "start"]
