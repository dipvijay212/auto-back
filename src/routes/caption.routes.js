import express from 'express';
import { generateCaption, getLatestCaption } from '../controllers/caption.controller.js';

const router = express.Router();

router.get('/latest', getLatestCaption);
router.post('/generate', generateCaption);

export default router;
