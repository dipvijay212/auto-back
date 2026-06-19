import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import logger from './middlewares/logger.js';
import { errorHandler, notFoundHandler } from './middlewares/error.js';

import instagramRoutes from './routes/instagram.routes.js';
import contentPlanRoutes from './routes/contentPlan.routes.js';
import sceneRoutes from './routes/scene.routes.js';
import imageBriefRoutes from './routes/imageBrief.routes.js';
import imagePromptRoutes from './routes/imagePrompt.routes.js';
import imageRoutes from './routes/image.routes.js';
import captionRoutes from './routes/caption.routes.js';
import voiceRoutes from './routes/voice.routes.js';
import reelRoutes from './routes/reel.routes.js';
import automationRoutes from './routes/automation.routes.js';
import topicRoutes from './routes/topic.routes.js';
import logRoutes from './routes/log.routes.js';

const app = express();

// 1) Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logger);

// Serve generated files statically (optional but good for hosting images/audio/videos)
app.use('/generated', express.static('generated'));

// Mount API routes
app.use('/api/instagram', instagramRoutes);
app.use('/api/content-plan', contentPlanRoutes);
app.use('/api/scenes', sceneRoutes);
app.use('/api/image-briefs', imageBriefRoutes);
app.use('/api/image-prompts', imagePromptRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/captions', captionRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/reels', reelRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/logs', logRoutes);



// 2) Health Check Endpoint
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  let dbStatus = 'DISCONNECTED';
  
  if (dbState === 1) dbStatus = 'CONNECTED';
  else if (dbState === 2) dbStatus = 'CONNECTING';
  else if (dbState === 3) dbStatus = 'DISCONNECTING';

  res.status(200).json({
    status: 'UP',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Test route to trigger operational error for verification
app.get('/test-error', (req, res, next) => {
  const err = new Error('This is a test operational error!');
  err.statusCode = 400;
  err.status = 'fail';
  err.isOperational = true;
  next(err);
});

// 3) Handle undefined routes
app.use(notFoundHandler);

// 4) Global Error Handler Middleware
app.use(errorHandler);

export default app;
