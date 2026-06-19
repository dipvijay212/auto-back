import express from 'express';
import {
  publishPost,
  publishReel,
  publishCarousel,
  publishFromDB,
  getLatestPublishedPost
} from '../controllers/instagram.controller.js';

const router = express.Router();

router.post('/publish', publishFromDB);
router.get('/latest', getLatestPublishedPost);
router.post('/post', publishPost);
router.post('/reel', publishReel);
router.post('/carousel', publishCarousel);

export default router;
