#!/bin/bash

# Startup script for Django backend
set -e

echo "Starting Django backend..."

# Wait for database to be ready
echo "Waiting for database..."
while ! python manage.py check --database default; do
  echo "Database is unavailable - sleeping"
  sleep 1
done

echo "Database is ready!"

# Create migrations for all apps
echo "Creating migrations..."
python manage.py makemigrations

# Apply migrations
echo "Applying migrations..."
python manage.py migrate

# Load dummy portfolio data (disabled - no default data needed)
# echo "Loading dummy portfolio data..."
# python manage.py load_dummy_portfolio

# Start Django development server
echo "Starting Django development server..."
python manage.py runserver 0.0.0.0:8000
