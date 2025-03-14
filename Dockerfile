FROM node:16-slim

# Install required system packages including crypto dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app source
COPY . .

# Create auth_info directory
RUN mkdir -p /app/auth_info

# Set environment variables
ENV NODE_ENV=production
ENV OPENSSL_CONF=/etc/ssl/openssl.cnf

# Start the bot
CMD ["npm", "start"]
