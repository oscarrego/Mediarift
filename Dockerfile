# ==========================================
# Stage 1: Build the React Frontend
# ==========================================
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy dependencies list
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source code
COPY frontend/ ./

# Build the production bundle (outputs to /app/frontend/dist)
RUN npm run build

# ==========================================
# Stage 2: Create the Python Runtime Environment
# ==========================================
FROM python:3.11-slim AS runtime
WORKDIR /app

# Install system dependencies (FFmpeg is critical for media extraction and conversion)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/requirements.txt ./backend/

# Install python dependencies (including Gunicorn for production execution)
RUN pip install --no-cache-dir -r backend/requirements.txt && \
    pip install --no-cache-dir gunicorn

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy backend source code
COPY backend/ ./backend/

# Expose backend/frontend unified port
EXPOSE 5000

# Set environment variables
ENV FLASK_ENV=production
ENV FLASK_DEBUG=false
ENV PORT=5000

# Run Flask server using the entrypoint script or direct python execution
CMD ["python", "backend/app.py"]
