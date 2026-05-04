# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Helpful on Alpine for some native dependencies
RUN apk add --no-cache libc6-compat

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy application source
COPY . .

# Build Next.js app
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache libc6-compat

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy built app artifacts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.* ./

EXPOSE 3000

CMD ["npm", "run", "start"]