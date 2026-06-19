import express from 'express';
import { createBriefs, getBriefsForPlan } from '../controllers/imageBrief.controller.js';

const router = express.Router();

router.post('/', createBriefs);
router.get('/plan/:contentPlanId', getBriefsForPlan);

export default router;
