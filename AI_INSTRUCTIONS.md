# Frontend AI Agent Instructions

This document provides context, constraints, and conventions for all AI agents working on the frontend codebase.

**Before writing code, always review this file.**
For human-focused system design and roadmap, see the `./docs/` directory.

---

## 1. Tech Stack
- **Core**: React 19 (Concurrent Mode), Vite, TypeScript
- **State**: Zustand (minimal stores)
- **Styling**: Tailwind CSS v4
- **Real-time**: Socket.io Client
- **Routing**: React Router

---

## 2. Global Constraints & Best Practices

### TypeScript
- **Strict Typing**: Avoid `any` — use `unknown` and narrow the type, or define a proper interface.
- **Imports**: Always use `import type` for type-only imports.
- **Bypasses**: Do not use `// @ts-ignore` or `// @ts-nocheck`.

### Styling & CSS
- **Tailwind First**: Use utility classes (Tailwind v4) heavily. 
- **Custom CSS**: Do not create `.module.css` or new custom CSS files unless absolutely necessary.
- **Global Theme**: Modify colors/fonts in `src/styles/index.css` under the `@theme` block.

### State Management
- **Zustand**: Keep stores minimal and focused. Do not combine unrelated state.
- **Partitioning**: Separate Auth state (`useAuthStore`) from Chat state (`useChatStore`).

### Optimistic UI
- Assume success for message sending: immediately append sent messages to the local store, and handle server acknowledgments/errors silently or visually update the message status.

---

## 3. Helpful Pointers
- Heavy business/fetching logic belongs in custom hooks (`src/hooks/`), keeping components focused on rendering.
