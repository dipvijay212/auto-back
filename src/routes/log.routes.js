import express from 'express';
import { getPipelineLogs } from '../controllers/log.controller.js';

const router = express.Router();

router.get('/', getPipelineLogs);

export default router;
