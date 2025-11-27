# Stage 1: Build the application
FROM node:lts-alpine3.22 AS builder
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
# Install ALL dependencies (dev + prod) for the build
# Mount a cache volume for Yarn using the correct global cache target path for root user
RUN --mount=type=cache,id=yarncache,target=/root/.yarn/berry/cache \
    yarn install --immutable

# Copy the rest of the source code
COPY . .

# Build the application (client and server)
RUN yarn build

# Prune devDependencies using yarn workspaces focus
# This is the recommended Yarn command for installing only production dependencies.
RUN yarn workspaces focus --production

# Stage 2: Production Runner
# Use a slim Node.js Alpine image
FROM node:lts-alpine3.22 AS runner

# Enable Corepack in the runner stage as well
# This ensures the correct yarn version is used for CMD
RUN corepack enable

# Set working directory
WORKDIR /app

# Create a non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy necessary configuration files and lockfile
COPY --chown=appuser:appgroup .yarnrc.yml .
COPY --chown=appuser:appgroup package.json .
COPY --chown=appuser:appgroup yarn.lock .

# Copy the .yarn directory containing plugins from the builder stage
COPY --from=builder --chown=appuser:appgroup /app/.yarn ./.yarn

# Copy PRUNED production node_modules from the builder stage
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules

# Copy the built application artifacts (client and server) from the builder stage
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

# Create and set permissions for the data directory (adjust path if needed)
RUN mkdir /app/data && chown -R appuser:appgroup /app/data
RUN mkdir /db && chown -R appuser:appgroup /db

VOLUME /app/data

# Switch to the non-root user
USER appuser

# Expose the port the app runs on
EXPOSE 5173

# Default command to run the application using the start script
CMD [ "yarn", "start" ] 