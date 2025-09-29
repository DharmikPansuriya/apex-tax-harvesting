FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY backend/ .

# Create necessary directories
RUN mkdir -p /app/reports /app/data

# Make startup script executable
RUN chmod +x /app/start.sh

EXPOSE 8000

CMD ["./start.sh"]
