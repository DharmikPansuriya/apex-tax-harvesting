#!/bin/bash

# Development script for TLH UK application
# This script runs backend and database in Docker, frontend locally

echo "Starting TLH UK development environment..."

# Start backend and database in Docker
echo "Starting backend and database..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
sleep 10

# Check if backend is running
if curl -f http://localhost:8000/api/health/ > /dev/null 2>&1; then
    echo "Backend is ready!"
else
    echo "Backend is not ready yet, but continuing..."
fi

# Start frontend locally
echo "Starting frontend locally..."
cd frontend
npm run dev
