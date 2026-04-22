// This file is the entry point of the server application. 
// It imports the Express app from app.ts and starts the server on a specified port.

import { createServer } from 'http';
import app from './app.js';
import { initSocket } from './socket/index.js';

const PORT = process.env.PORT || 3000;

const server = createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});