# ==============================================================================
# Stage 1: Build Next.js frontend (static export)
# ==============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
ENV NEXT_OUTPUT_EXPORT=true
RUN npm run build:export

# ==============================================================================
# Stage 2: Python Backend & Static Asset Server
# ==============================================================================
FROM python:3.11-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-builder /app/frontend/out ./frontend/out

ENV PORT=8040
ENV PYTHONUNBUFFERED=1
ENV NABD_CORS="*"

EXPOSE 8040

WORKDIR /app/backend

# Render injects $PORT dynamically. Uvicorn binds to 0.0.0.0:$PORT
CMD ["sh", "-c", "uvicorn nabd.main:app --host 0.0.0.0 --port ${PORT:-8040}"]
