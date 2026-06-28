// This file sets up the Express application, including middleware and routes. 
// It is imported by server.ts to start the server.

import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { apiRateLimiter } from './middleware/rateLimit.middleware.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', apiRateLimiter, routes);

export default app;