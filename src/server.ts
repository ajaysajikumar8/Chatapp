// This file is the entry point of the server application. 
// It imports the Express app from app.ts and starts the server on a specified port.

import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});