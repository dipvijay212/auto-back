import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import app from './src/app.js';
import connectDB from './src/config/db.js';
import { initAutomationJob } from './src/jobs/automation.job.js';

// Connect to MongoDB
connectDB();

// Initialize scheduled background jobs
initAutomationJob();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`[Server] Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handling unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('[Unhandled Rejection] Shutting down server gracefully...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handling uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception] Shutting down process immediately...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});
