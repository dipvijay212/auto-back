import express from 'express';
import { createPrompts, getPromptsForPlan, getLatestPrompts } from '../controllers/imagePrompt.controller.js';

const router = express.Router();

router.get('/latest', getLatestPrompts);
router.post('/', createPrompts);
router.get('/plan/:contentPlanId', getPromptsForPlan);

export default router;
