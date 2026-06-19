import express from 'express';
import { generateImages, getImages, deleteImage, getLatestImages } from '../controllers/image.controller.js';

const router = express.Router();

router.get('/latest', getLatestImages);
router.post('/generate', generateImages);
router.get('/', getImages);
router.delete('/:id', deleteImage);

export default router;
