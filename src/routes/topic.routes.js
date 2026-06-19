import express from 'express';
import {
  getTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  generateAITopics,
  triggerPipeline
} from '../controllers/topic.controller.js';

const router = express.Router();

router.get('/', getTopics);
router.post('/', createTopic);
router.put('/:id', updateTopic);
router.delete('/:id', deleteTopic);
router.post('/ai-generate', generateAITopics);
router.post('/trigger', triggerPipeline);

export default router;
