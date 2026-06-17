# Frontend Architecture

This document covers the frontend system design, state management strategy, and development roadmap.

## 1. System Overview

The frontend is a React-based Single Page Application (SPA) that communicates with the backend via a hybrid REST + WebSocket model.

```
                      ┌──────────────────┐
                      │   React App      │
                      └────────┬─────────┘
                               │
               ┌───────────────┴───────────────┐
        ┌──────▼──────┐                 ┌──────▼──────┐
        │   Services  │                 │    Stores   │
        │ (Axios/WS)  │                 │  (Zustand)  │
        └──────┬──────┘                 └──────┬──────┘
               │                               │
    ┌──────────┴──────────┐          ┌─────────┴─────────┐
    │  REST API (HTTP)    │          │ UI Components     │
    └─────────────────────┘          └───────────────────┘
```

## 2. Key Design Decisions

### Optimistic UI
Messages are added to the local store immediately upon sending, then updated with a "sent" status once the server acknowledges via the HTTP/Socket response.

### State Partitioning
Auth state and Chat state are kept in separate Zustand stores to avoid unnecessary re-renders.

### CSS-in-CSS
Leveraging Tailwind v4's new CSS-first configuration to keep the root directory free of configuration files like `tailwind.config.js`.

### Component-First Logic
Heavy business logic is moved into custom hooks (`src/hooks/`) to keep components focused on rendering.

## 3. Core Layers

1. **Services (`src/services/`)**: Handles all external communication (Axios and Socket.io).
2. **Stores (`src/store/`)**: Centralized state using Zustand (`useAuthStore`, `useChatStore`). Partitioned to avoid unnecessary re-renders.
3. **Components (`src/components/` & `src/pages/`)**: Reusable UI and route-level components. Heavy logic is abstracted to hooks.
4. **Styles (`src/styles/`)**: `index.css` acts as the single entry point for Tailwind v4 configuration.

## 4. Development Roadmap

### Phase 1 — Core Messaging System
*   Basic project setup (Vite + React + Tailwind v4)
*   Authentication UI (Login/Register)
*   Chat Layout (Sidebar + Chat Window)
*   Real-time message sending/receiving via Socket.io
*   Fetching historical messages via REST

### Phase 2 — Reliability & State Handling
*   Online/offline presence indicators
*   Typing indicators
*   Read receipts (UI state)
*   Message ordering logic
*   Reconnection handling with visual cues

### Phase 3 — Scalability & Polish
*   Infinite scroll for message history
*   Optimized message list rendering (virtualization if needed)
*   Media support (UI for uploading and rendering image/file attachments)
*   Profile management UI
*   Search interface

### Phase 4 — Production Readiness
*   Dockerization for frontend
*   Environment variable management (`.env`)
*   Sentry/Error monitoring integration
*   Performance auditing (Lighthouse)
