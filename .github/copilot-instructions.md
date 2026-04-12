# Copilot Instructions

This file defines coding conventions for this repository. Follow these rules when generating or suggesting code.

## Stack

- Node.js + Express + TypeScript
- Prisma ORM + PostgreSQL
- JWT authentication via `jsonwebtoken`
- Socket.io for real-time messaging

## API Response Format

**All** HTTP responses must use the helpers from `src/utils/response.ts`. Never call `res.status(...).json(...)` directly in a controller.

### Success

```ts
return sendSuccess(res, "Human-readable message", data);          // 200
return sendSuccess(res, "Resource created", data, 201);            // custom status
```

Shape:
```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { ... }
}
```

### Error

```ts
return sendError(res, "Human-readable error message", 400);        // client error
return sendError(res, "Something went wrong");                     // 500 default
```

Shape:
```json
{
  "success": false,
  "message": "Human-readable error message"
}
```

### Rules

- `data` must always be present on success responses (use `null` if there is nothing to return, e.g. logout or delete).
- Never use `error` as a key in a JSON response body. Use `message` via `sendError`.
- HTTP status codes must still be semantically correct (200, 201, 400, 401, 403, 404, 500, etc.).

## Authentication

- `req.user` is typed as `{ id: string }` and is set by `authMiddleware`.
- Always use `req.user!.id` inside protected controllers. Do not access `req.user.userId`.

## File & Folder Conventions

- Controllers live in `src/controllers/` and only handle HTTP in/out. No business logic.
- Business logic lives in `src/services/`.
- All database access goes through Prisma via `src/lib/prisma.ts`.
- Utility functions live in `src/utils/`.
- Route definitions live in `src/routes/`.

## TypeScript

- Always use `import type` for type-only imports.
- Avoid `any` — use `unknown` and narrow the type, or define a proper interface.
- Do not use `// @ts-ignore` or `// @ts-nocheck`.
