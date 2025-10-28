# syntax=docker/dockerfile:1

# Build stage: install dependencies and compile the Vite app
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies based on lockfile to ensure reproducible builds
COPY package*.json ./
RUN npm ci

# Copy the rest of the source and build the production bundle
COPY . .
RUN npm run build

# Production stage: serve the static assets with nginx
FROM nginx:1.28-alpine-slim AS production

# Copy the compiled app from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose the default nginx HTTP port
EXPOSE 80

# Use the default nginx start command
CMD ["nginx", "-g", "daemon off;"]
