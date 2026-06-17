# Chat Backend API Documentation

This document outlines the REST API endpoints and WebSocket events available for the Chat Backend application.

## Base Configuration

*   **Base URL**: `/api` (Assuming routes are prefixed with `/api` in your main app)
*   **Authentication**: Most routes require a JWT token. Send it in the HTTP headers as:
    `Authorization: Bearer <your_jwt_token>`
*   **Response Format**: All endpoints return a standard JSON structure:
    ```json
    {
      "success": true, // or false
      "message": "Human readable message",
      "data": {} // The requested data or null on error
    }
    ```

---

## 1. Authentication (`/auth`)

### Register User
*   **Method**: `POST`
*   **Endpoint**: `/auth/register`
*   **Auth Required**: No
*   **Body:**
    ```json
    {
      "email": "user@example.com",
      "password": "password123",
      "displayName": "John Doe"
    }
    ```
*   **Success Response (201):** Returns the created user object (excluding password).

### Login User
*   **Method**: `POST`
*   **Endpoint**: `/auth/login`
*   **Auth Required**: No
*   **Body:**
    ```json
    {
      "email": "user@example.com",
      "password": "password123"
    }
    ```
*   **Success Response (200):** Returns the user object and the JWT token.

---

## 2. Users (`/users`)

### Search Users
*   **Method**: `GET`
*   **Endpoint**: `/users?q={search_query}`
*   **Auth Required**: Yes
*   **Description**: Searches for users by their email or display name (case-insensitive). Excludes the currently authenticated user from results.
*   **Success Response (200):** Returns an array of matching user objects (limited to 20).

---

## 3. Conversations (`/conversations`)

### Get User's Conversations
*   **Method**: `GET`
*   **Endpoint**: `/conversations`
*   **Auth Required**: Yes
*   **Description**: Fetches all conversations the current user is a part of.
*   **Success Response (200):** Returns an array of conversation objects.

### Create or Fetch Conversation
*   **Method**: `POST`
*   **Endpoint**: `/conversations`
*   **Auth Required**: Yes
*   **Description**: Creates a new 1-on-1 conversation with another user, or returns the existing one if it already exists.
*   **Body:**
    ```json
    {
      "participantId": "uuid-of-the-other-user"
    }
    ```
*   **Success Response (200/201):** Returns the conversation object.

---

## 4. Messages (`/messages`)

### Get Messages in a Conversation
*   **Method**: `GET`
*   **Endpoint**: `/messages/:conversationId`
*   **Auth Required**: Yes
*   **Description**: Fetches all messages for a specific conversation. The user must be a participant in the conversation.
*   **Success Response (200):** Returns an array of message objects.

### Send a New Message
*   **Method**: `POST`
*   **Endpoint**: `/messages/:conversationId`
*   **Auth Required**: Yes
*   **Description**: Sends a new message to a specific conversation.
*   **Body:**
    ```json
    {
      "content": "Hello, how are you?"
    }
    ```
*   **Success Response (201):** Returns the newly created message object. *(Note: This also triggers the `new_message` WebSocket event for other participants).*

### Edit a Message
*   **Method**: `PUT`
*   **Endpoint**: `/messages/:id`
*   **Auth Required**: Yes
*   **Description**: Updates the content of an existing message. The user must be the sender of the message.
*   **Body:**
    ```json
    {
      "content": "Updated message text"
    }
    ```
*   **Success Response (200):** Returns the updated message object.

### Delete a Message
*   **Method**: `DELETE`
*   **Endpoint**: `/messages/:id`
*   **Auth Required**: Yes
*   **Description**: Deletes a message. The user must be the sender of the message.
*   **Success Response (200):** Returns `null` data.

---

## 5. WebSockets (`Socket.IO`)

The server provides real-time updates via Socket.IO.

### Connection & Authentication
To connect, the client must provide their JWT token in the handshake authentication payload:
```javascript
const socket = io("http://localhost:3000", {
  auth: {
    token: "eyJhbGciOi..." // The user's JWT Token
  }
});
```

### Events Received from Server (Listen to these)

*   **Event:** `new_message`
    *   **Description**: Triggered when someone sends a message to a conversation the current user is a part of.
    *   **Payload**: The complete Message object.
    ```javascript
    socket.on("new_message", (message) => {
        console.log("New message received:", message);
    });
    ```
