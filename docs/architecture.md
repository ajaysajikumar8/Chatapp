# Backend System Architecture

This document covers the backend system design, database schema, and development roadmap.

## 1. System Overview

The backend is a real-time messaging server built around a REST + WebSocket hybrid model.

```
                      ┌──────────────────┐
                      │   React App      │
                      └────────┬─────────┘
                               │
               ┌───────────────┴───────────────┐
        ┌──────▼──────┐                 ┌──────▼──────┐
        │ REST (HTTP) │                 │  WebSocket  │
        └──────┬──────┘                 └──────┬──────┘
               │                               │
        ┌──────▼──────┐                 ┌──────▼──────┐
        │ Express APIs│                 │  Socket.io  │
        └──────┬──────┘                 └──────┬──────┘
               │                               │
        ┌──────▼───────────────────────────────▼──────┐
        │                  PostgreSQL                 │
        │               (via Prisma ORM)              │
        └─────────────────────────────────────────────┘
```

## 2. Key Design Decisions

### Hybrid Communication
**Why Socket.io over raw WebSockets?**  
Automatic reconnection, room management, and fallback transports significantly reduce boilerplate. Can be replaced with a raw WS layer later if needed.

### Database
**Why Prisma?**  
Type-safe queries with migration support. Easy to swap the underlying adapter if moving away from PostgreSQL.

**Message Ordering**  
Messages are ordered by `created_at` (DB-assigned server timestamp), not client timestamp, to prevent clock skew issues.

## 3. Backend Architecture

### Core Layers
1. **Controllers (`src/controllers/`)**: Handle HTTP in/out. No business logic.
2. **Services (`src/services/`)**: Core business logic.
3. **Prisma Client (`src/lib/prisma.ts`)**: Single instance for database access.
4. **Sockets (`src/sockets/`)**: WebSocket event handlers.

## 4. Development Roadmap

### Phase 1 — Core Messaging System
Goal: Working 1–1 chat with persistence.
*   Basic project setup (Express/Prisma)
*   JWT authentication (register + login)
*   REST APIs: conversations, message history
*   Socket.io: send and receive messages
*   Persist messages to PostgreSQL

### Phase 2 — Reliability & State Handling
Goal: Behave like a real production system.
*   Online/offline presence
*   Typing indicators
*   Read receipts
*   Message ordering guarantees
*   Client reconnect + retry logic
*   Pagination for message history

### Phase 3 — Scalability Layer
Goal: Horizontal scalability.
*   Redis Pub/Sub for cross-instance message fan-out
*   Redis for tracking online users
*   Multiple server instances behind Nginx
*   DB connection pooling

### Phase 4 — DevOps & Production Readiness
Goal: Deployable like a real product.
*   Docker + Docker Compose for local and prod
*   Environment config separation (`.env`, secrets)
*   HTTPS via Nginx + Let's Encrypt
*   Deploy to AWS EC2 / Vercel
*   Structured logging & Error monitoring

### Phase 5 — Intelligence Layer (Optional)
*   AI summary of long chat threads
*   Full-text search with ranking
