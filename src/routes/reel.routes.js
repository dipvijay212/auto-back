import express from 'express';
import { generateReel, getLatestReel, getReels, deleteReel } from '../controllers/reel.controller.js';

const router = express.Router();

router.post('/generate', generateReel);
router.get('/latest', getLatestReel);
router.get('/', getReels);
router.delete('/:id', deleteReel);

export default router;
