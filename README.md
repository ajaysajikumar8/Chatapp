# Frontend — Chat Application

## Overview

This is the frontend for a real-time chat application. It provides authentication, conversation management, and live messaging using WebSockets. The UI is designed to be responsive, fast, and minimal, with a focus on real-time user experience.

---

## Tech Stack

- **React 19** — UI library
- **TypeScript** — Type safety
- **Tailwind CSS v4** — Styling (with CSS-based configuration)
- **Zustand** — State management
- **Socket.io Client** — Real-time communication

---

## Folder Structure

```
src/
│
├── components/        # Reusable UI components
├── pages/             # Route-level pages (Auth, Chat, etc.)
├── hooks/             # Custom React hooks
├── store/             # Zustand state management
├── services/          # API & socket logic
├── utils/             # Helper functions
├── types/             # TypeScript types/interfaces
├── styles/            # Global styles & Tailwind v4 theme configuration
│   └── index.css      # Entry point for all CSS and Tailwind variables
│
├── App.tsx
├── main.tsx
```

---

## State Management (Zustand)

Used for:

- Auth state (user session, token)
- Active conversation
- Messages cache
- Online users (future phase)

Keep it minimal. Don’t turn this into Redux 2.0.

---

## Styling Strategy (Tailwind)

### Global Styles

Handled in `src/styles/index.css`. Use this file for:

- **Tailwind v4 Configuration**: Define colors and fonts in the `@theme` block.
- **CSS Resets**: Custom base styles or browser-specific fixes.
- **Global Variables**: Theme-wide CSS variables.
- **Scrollbar Styling**: Custom sleek scrollbars for chat windows.

Everything else → Tailwind utility classes.

### Component Styling

- **Prefer Utility Classes**: Use inline Tailwind classes for 99% of styling.
- **Reusable Components**: Extract repeated patterns into React components, not CSS classes.
- **Avoid Custom CSS**: Do not create `.module.css` or large custom CSS files unless absolutely necessary.

---

## API Integration

All API calls are handled in `services/`:

- Auth APIs (login, register)
- Conversations
- Messages

Use a centralized API client (e.g., Axios instance) for:

- Base URL
- Auth headers
- Error handling

---

## WebSocket Integration

- Initialize Socket.io client after authentication
- Maintain a single connection instance
- Handle:
    - Incoming messages
    - Message acknowledgements
    - Reconnection logic (later phase)

---

## Environment Variables

Create a `.env` file:

```
VITE_API_BASE_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

---

## Running the Project

```bash
# install dependencies
npm install

# start development server
npm run dev
```

---

## Build

```bash
npm run build
```

---

---

## Development Notes

- Keep components small and focused
- Avoid premature abstraction
- Optimize only when necessary
- Prefer clarity over cleverness

---
