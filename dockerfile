# Build stage - Frontend
FROM node:20-alpine AS frontend-builder

# Set the working directory
WORKDIR /app

# Copy frontend package files
COPY package*.json ./

# Install frontend dependencies
RUN npm install

# Copy frontend source code
COPY src ./src
COPY public ./public
COPY tsconfig.json ./
COPY webpack.config.js ./

# Build the frontend application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Copy backend server files
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --production

# Copy server source
COPY server/index.js ./

# Copy built frontend files
WORKDIR /app
COPY --from=frontend-builder /app/build ./build

# Install serve to host frontend
RUN npm install -g serve

# Create startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'cd /app/server && node index.js &' >> /app/start.sh && \
    echo 'serve -s /app/build -l 7320' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose ports (7320 for frontend, 5000 for backend API)
EXPOSE 7320 5000

# Set environment variable for API URL
ENV REACT_APP_PROXY_URL=http://localhost:5000

# Start both backend and frontend
CMD ["/bin/sh", "/app/start.sh"]