# Chat Backend

This is the Node.js/Express backend for the real-time chat application.

> **Note**: For system design, architecture, and API documentation, please see the `docs/` directory at the root of the project. For AI agent instructions, see `AI_INSTRUCTIONS.md` at the root.

## Prerequisites

- Node.js 18+
- PostgreSQL running locally
- npm

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and ensure DATABASE_URL is pointing to a valid, running PostgreSQL instance.

# 3. Run database migrations
npx prisma migrate dev

# 4. Start development server
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (e.g., `postgresql://user:password@localhost:5432/chatdb`). |
| `JWT_SECRET` | Secret used to sign JWT tokens. |
| `PORT` | Port the server listens on (default: `3000`). |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
