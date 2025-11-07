# --- 1️⃣ Build stage ---
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- 2️⃣ AWS Lambda Web Adapter (official ECR image) ---
FROM public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 AS lambda-adapter

# --- 3️⃣ Runtime stage ---
FROM node:18-alpine AS runner
WORKDIR /app

# ✅ Copy the adapter from AWS public ECR (multi-arch ready)
COPY --from=lambda-adapter /lambda-adapter /opt/extensions/lambda-adapter

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    AWS_LWA_ENABLE_COMPRESSION=true \
    AWS_LWA_ASYNC_INIT=true

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 8080
CMD ["node", "server.js"]