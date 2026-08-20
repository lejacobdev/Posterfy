# syntax=docker/dockerfile:1

# ---- build ----------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies first so the layer caches across source changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime --------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Production dependencies only; the server itself has none.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY server ./server

# Never run the app as root.
USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
