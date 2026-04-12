# Architecture

This document covers the system design, database schema, scalability approach, and development roadmap for the chat backend.

## Overview

The system is a real-time messaging backend built around a REST + WebSocket hybrid model. REST handles authentication and fetching historical data. Socket.io handles live message delivery and presence events.

```
Client
  │
  ├── REST (HTTP)     → Express routes → Prisma → PostgreSQL
  └── WebSocket       → Socket.io handlers → PostgreSQL / Redis
```

## Database Schema

The schema is defined in [`prisma/schema.prisma`](prisma/schema.prisma) — that file is the single source of truth. Migrations live in `prisma/migrations/`.


---

## Roadmap

### Phase 1 — Core Messaging System
Goal: Working 1–1 chat with persistence.

- MVC-ish project structure
- JWT authentication (register + login)
- REST APIs: conversations, message history
- Socket.io: send and receive messages
- Persist messages to PostgreSQL
- Fetch paginated chat history

### Phase 2 — Reliability & State Handling
Goal: Behave like a real production system.

- Online/offline presence
- Typing indicators
- Read receipts
- Message ordering guarantees
- Client reconnect + retry logic
- Rate limiting
- Pagination for message history
- DB index optimisation

### Phase 3 — Scalability Layer
Goal: Horizontal scalability.

- Redis Pub/Sub for cross-instance message fan-out
- Redis for tracking online users
- Multiple server instances behind Nginx
- Sticky sessions for WebSocket connections
- DB connection pooling
- Query profiling and index tuning

```
                        ┌─────────────┐
                        │    Nginx    │
                        └──────┬──────┘
               ┌───────────────┴───────────────┐
        ┌──────▼──────┐                ┌───────▼─────┐
        │  Server 1   │                │  Server 2   │
        └──────┬──────┘                └──────┬──────┘
               └───────────┬───────────────────┘
                        ┌──▼──┐
                        │Redis│  ← Pub/Sub + presence
                        └──┬──┘
                        ┌──▼──────┐
                        │PostgreSQL│
                        └──────────┘
```

### Phase 4 — DevOps & Production Readiness
Goal: Deployable like a real product.

- Docker + Docker Compose for local and prod
- Environment config separation (`.env`, secrets)
- HTTPS via Nginx + Let's Encrypt
- Deploy to AWS EC2
- Structured logging
- Error monitoring
- Health check endpoint (`GET /health`)

### Phase 5 — Intelligence Layer
Pick one:

- AI summary of long chat threads
- Weekly digest email
- Full-text search with ranking
- Chat analytics dashboard
- Structured decision tagging

### Phase 6 — Android Client
Goal: Prove the backend is client-agnostic.

- Same REST APIs
- Same WebSocket events
- JWT auth
- Basic native UI
- Push notifications *(optional)*

---

## Key Design Decisions

**Why Socket.io over raw WebSockets?**  
Automatic reconnection, room management, and fallback transports significantly reduce boilerplate in Phase 1. Can be replaced with a raw WS layer later if needed.

**Why Prisma?**  
Type-safe queries with migration support. Easy to swap the underlying adapter if moving away from PostgreSQL.

**Why Redis in Phase 3 and not earlier?**  
A single server instance doesn't need Pub/Sub. Introducing Redis before it's needed adds operational complexity without benefit.

**Message ordering**  
Messages are ordered by `created_at` (DB-assigned server timestamp), not client timestamp, to prevent clock skew issues on mobile clients.