FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY frontend/ .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership
RUN chown -R nextjs:nodejs /app

EXPOSE 3000

# Run as root initially to avoid permission issues
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
