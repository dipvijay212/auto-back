import express from 'express';
import { getConfig, updateConfig } from '../controllers/automation.controller.js';

const router = express.Router();

router.get('/', getConfig);
router.post('/', updateConfig);

export default router;
