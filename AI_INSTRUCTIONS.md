# Backend AI Agent Instructions

This document provides context, constraints, and conventions for all AI agents working on the backend codebase.

**Before writing code, always review this file.**
For human-focused system design, APIs, and database migration rules, see the `./docs/` directory.

---

## 1. Tech Stack
- **Core**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (managed via Prisma)
- **Real-time**: Socket.io (WebSocket)
- **Auth**: JWT (`jsonwebtoken`)

---

## 2. Global Constraints & Best Practices

### TypeScript
- **Strict Typing**: Avoid `any` — use `unknown` and narrow the type, or define a proper interface.
- **Imports**: Always use `import type` for type-only imports.
- **Bypasses**: Do not use `// @ts-ignore` or `// @ts-nocheck`.

### API Responses
**All** HTTP responses must use the helpers from `src/utils/response.ts`. Never call `res.status(...).json(...)` directly in a controller.

*   **Success**: `return sendSuccess(res, "Message", data, 200);`
*   **Error**: `return sendError(res, "Error Message", 400);`
*   `data` must always be present on success (use `null` if empty). Never use `error` as a JSON key.

### Authentication
- `req.user` is typed as `{ id: string }`. Always use `req.user!.id` in protected controllers.
- Sockets expect JWT in the connection handshake (`auth: { token }`).

### Architecture Conventions
- **Controllers (`src/controllers/`)**: Handle HTTP in/out ONLY. No business logic.
- **Services (`src/services/`)**: Core business logic.

---

## 3. Helpful Pointers
- **Database schema changes**: Read `./docs/database.md` before generating migrations.
- **New endpoints**: Ensure they follow the contracts in `./docs/api.md`.
