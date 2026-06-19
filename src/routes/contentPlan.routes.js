import express from 'express';
import { createPlan, getLatestPlan } from '../controllers/contentPlan.controller.js';

const router = express.Router();

router.get('/latest', getLatestPlan);
router.post('/', createPlan);

export default router;
