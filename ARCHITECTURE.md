# Frontend Architecture — Chat Application

This document covers the frontend system design, state management strategy, and development roadmap.

## Overview

The frontend is a React-based Single Page Application (SPA) that communicates with the backend via a hybrid REST + WebSocket model.

```
                     ┌──────────────────┐
                     │   React App      │
                     └────────┬─────────┘
                              │
               ┌──────────────┴──────────────┐
        ┌──────▼──────┐               ┌──────▼──────┐
        │   Services  │               │    Stores   │
        │ (Axios/WS)  │               │  (Zustand)  │
        └──────┬──────┘               └──────┬──────┘
               │                             │
    ┌──────────┴──────────┐        ┌─────────┴─────────┐
    │  REST API (HTTP)    │        │ UI Components     │
    └─────────────────────┘        └───────────────────┘
```

## Tech Stack

- **React 19**: Modern UI library with Concurrent Mode support.
- **Vite**: Ultra-fast build tool and dev server.
- **Tailwind CSS v4**: Utility-first styling with CSS-based theme configuration.
- **Zustand**: Minimalist state management for auth and messaging.
- **Socket.io Client**: Real-time event handling with automatic reconnection.
- **React Router**: Client-side routing.

---

## Core Layers

### 1. Services (`src/services/`)
Handles all external communication.
- **`api.ts`**: Axios instance with interceptors for JWT injection and error handling.
- **`socket.ts`**: Socket.io initialization and event listener setup.

### 2. Stores (`src/store/`)
Centralized state using Zustand.
- **`useAuthStore`**: Manages user session, tokens, and profile.
- **`useChatStore`**: Manages active conversation, message list, and optimistic updates.

### 3. Components (`src/components/` & `src/pages/`)
- **`pages/`**: Route-level components that orchestrate data fetching (e.g., `LoginPage`, `ChatPage`).
- **`components/`**: Reusable UI atoms and molecules (e.g., `MessageBubble`, `ChatInput`).

### 4. Styles (`src/styles/`)
- **`index.css`**: The single entry point for Tailwind v4, theme variables, and global resets.

---

## Key Design Decisions

- **Optimistic UI**: Messages are added to the local store immediately upon sending, then updated with a "sent" status once the server acknowledges.
- **State Partitioning**: Auth state and Chat state are kept in separate stores to avoid unnecessary re-renders.
- **CSS-in-CSS**: Leveraging Tailwind v4's new CSS-first configuration to keep the root directory free of configuration files like `tailwind.config.js`.
- **Component-First Logic**: Heavy business logic is moved into custom hooks (`src/hooks/`) to keep components focused on rendering.

---

## Roadmap (Synced with Backend)

### Phase 1 — Core Messaging System
- Basic project setup (Vite + React + Tailwind v4)
- Authentication UI (Login/Register)
- Chat Layout (Sidebar + Chat Window)
- Real-time message sending/receiving via Socket.io
- Fetching historical messages via REST

### Phase 2 — Reliability & State Handling
- Online/offline presence indicators
- Typing indicators
- Read receipts (UI state)
- Message ordering logic
- Reconnection handling with visual cues

### Phase 3 — Scalability & Polish
- Infinite scroll for message history
- Optimized message list rendering (virtualization if needed)
- Profile management UI
- Search interface

### Phase 4 — Production Readiness
- Dockerization for frontend
- Environment variable management (`.env`)
- Sentry/Error monitoring integration
- Performance auditing (Lighthouse)
