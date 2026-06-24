# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json prisma.config.js tsconfig.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies)
RUN npm ci

# Generate Prisma Client (uses schema.prisma configuration)
RUN npx prisma generate

# Copy source code
COPY . .

# Compile TS to JS
RUN npm run build

# Stage 2: Production runner
FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json prisma.config.js ./
COPY prisma ./prisma/

# Install only production dependencies
RUN npm ci --only=production

# Copy generated Prisma client from builder
COPY --from=builder /usr/src/app/src/generated /usr/src/app/src/generated

# Copy compiled JS files
COPY --from=builder /usr/src/app/dist ./dist

# Copy entrypoint script
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000

ENV NODE_ENV=production

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "dist/server.js"]
