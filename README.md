# chat-backend

Backend for a real-time chat application — REST APIs, WebSocket messaging, JWT authentication, and persistent message storage.

> See [ARCHITECTURE.md](ARCHITECTURE.md) for system design, database schema, scalability decisions, and the full roadmap.

## Stack

- **Node.js** + **Express** + **TypeScript**
- **Socket.io** — real-time messaging
- **Prisma** — ORM
- **PostgreSQL** — primary database
- **Redis** — pub/sub and presence *(Phase 3)*

## Prerequisites

- Node.js 18+
- PostgreSQL running locally (or a connection string)
- npm

## Getting Started

```bash
# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign JWT tokens |
| `PORT` | Port the server listens on (default: `3000`) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |

## API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register` | — | Register a new user |
| `POST` | `/auth/login` | — | Login, returns JWT |
| `GET` | `/conversations` | JWT | List user's conversations |
| `GET` | `/conversations/:id/messages` | JWT | Paginated message history |

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `message:send` | Client → Server | Send a message |
| `message:receive` | Server → Client | Incoming message |
| `user:typing` | Client → Server | Typing indicator |
| `user:presence` | Server → Client | Online/offline status |

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes and open a pull request

## License

ISC
