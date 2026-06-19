import express from 'express';
import {
  generateVoiceScript,
  generateVoice,
  getLatestVoiceScript,
  getLatestAudio
} from '../controllers/voice.controller.js';

const router = express.Router();

router.post('/generate-script', generateVoiceScript);
router.post('/generate', generateVoice);
router.get('/latest-script', getLatestVoiceScript);
router.get('/latest-audio', getLatestAudio);

export default router;

