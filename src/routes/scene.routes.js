import express from 'express';
import { createScenes, getLatestScenes } from '../controllers/scene.controller.js';

const router = express.Router();

router.get('/latest', getLatestScenes);
router.post('/', createScenes);

export default router;
