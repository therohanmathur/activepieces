FROM node:18.20.5-bullseye-slim AS base

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        openssh-client \
        python3 \
        g++ \
        build-essential \
        git \
        poppler-utils \
        poppler-data \
        locales \
        locales-all \
        libcap-dev && \
    yarn config set python /usr/bin/python3 && \
    npm install -g node-gyp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set npm and pnpm versions
RUN npm i -g npm@9.9.3 pnpm@9.15.0

# Set the locale
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8
ENV NX_DAEMON=false

# Pre-install isolated-vm globally
RUN cd /usr/src && npm i isolated-vm@5.0.1

# Preload TS types into pnpm store (optional but helpful)
RUN pnpm store add @tsconfig/node18@1.0.0 \
    && pnpm store add @types/node@18.17.1 \
    && pnpm store add typescript@4.9.4

### STAGE 1: Build ###
FROM base AS build

# Add build arguments
ARG VITE_API_TOKEN
ENV VITE_API_TOKEN=$VITE_API_TOKEN

WORKDIR /usr/src/app

# Copy and install dependencies
COPY .npmrc package.json package-lock.json ./
RUN npm ci

# Copy the full source code
COPY . .

# Build backend, frontend and pieces
RUN npx nx run-many --target=build --projects=server-api --configuration production --skip-nx-cache
RUN npx nx run-many --target=build --projects=react-ui --skip-nx-cache

# Install production dependencies for backend
RUN cd dist/packages/server/api && npm install --production --force

### STAGE 2: Run ###
FROM base AS run

WORKDIR /usr/src/app

# Install Nginx and gettext (for envsubst if needed)
RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx gettext && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Nginx config
COPY nginx.react.conf /etc/nginx/nginx.conf

# Set up isolate config
COPY packages/server/api/src/assets/default.cf /usr/local/etc/isolate

# Copy license (optional)
COPY --from=build /usr/src/app/LICENSE .

# Create target folders
RUN mkdir -p /usr/src/app/dist/packages/{server,engine,shared}

# Copy built backend, frontend and pieces from build stage
COPY --from=build /usr/src/app/dist/packages/engine/ /usr/src/app/dist/packages/engine/
COPY --from=build /usr/src/app/dist/packages/server/ /usr/src/app/dist/packages/server/
COPY --from=build /usr/src/app/dist/packages/shared/ /usr/src/app/dist/packages/shared/

# Install backend production dependencies again (to be safe in run image)
RUN cd /usr/src/app/dist/packages/server/api/ && npm install --production --force

# Copy frontend build to Nginx root
COPY --from=build /usr/src/app/dist/packages/react-ui /usr/share/nginx/html/

# Entrypoint setup
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh
ENTRYPOINT ["./docker-entrypoint.sh"]

EXPOSE 80

LABEL service=icustomer
