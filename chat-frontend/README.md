# Chat Frontend

This is the React 19 frontend for the real-time chat application.

> **Note**: For system design, architecture, and API documentation, please see the `docs/` directory at the root of the project. For AI agent instructions, see `AI_INSTRUCTIONS.md` at the root.

## Prerequisites

- Node.js 18+
- npm

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
```

## Environment Variables

If required, create a `.env` file in this directory:

```
VITE_API_BASE_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` for production |
| `npm run preview` | Preview the production build locally |
