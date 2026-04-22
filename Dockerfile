FROM node:20-slim AS frontend-build

WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY frontend/ .
RUN npm run build

# ---- Final image: Python + Node runtime ----
FROM python:3.11-slim

# System deps: PostgreSQL, OpenCV, tesseract, Node.js runtime
RUN apt-get update && apt-get install -y \
    libpq-dev gcc curl \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 \
    tesseract-ocr \
    supervisor \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ---- Backend ----
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .

# ---- Frontend (built output + node_modules for next start) ----
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps --production
COPY --from=frontend-build /frontend/.next ./.next
COPY --from=frontend-build /frontend/public ./public
COPY --from=frontend-build /frontend/next.config.* ./

# ---- Supervisor config (runs both processes) ----
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 8000 3000

CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
