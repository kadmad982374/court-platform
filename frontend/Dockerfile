# ============================================================
# frontend/Dockerfile
# Multi-stage build: Node (Vite build) → Nginx static serve
# ============================================================

# ── Stage 1: build ──────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
COPY . .
# VITE_BACKEND_URL is not needed at build time — Nginx handles /api proxy
RUN npm run build

# ── Stage 2: nginx ──────────────────────────────────────────
FROM nginx:1.27-alpine
# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf
# Copy our nginx config
COPY nginx/nginx.conf /etc/nginx/conf.d/app.conf
# Copy built frontend
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

