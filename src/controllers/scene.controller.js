import sceneGeneratorService from '../services/sceneGenerator.service.js';
import SceneStoryboard from '../models/sceneStoryboard.model.js';
import ContentPlan from '../models/contentPlan.model.js';
import AppError from '../utils/appError.js';

const catchAsync = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

import crypto from 'crypto';

export const createScenes = catchAsync(async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  let { contentPlanId, topic } = req.body;

  console.log(`[SceneController] [Request ID: ${requestId}] createScenes invoked. topic: "${topic || ''}", contentPlanId: ${contentPlanId || 'N/A'}`);

  if (!contentPlanId) {
    const latestPlan = await ContentPlan.findOne().sort({ createdAt: -1 });
    if (!latestPlan) {
      console.warn(`[SceneController] [Request ID: ${requestId}] No content plans found.`);
      return next(new AppError('No content plan found. Please generate a content plan first.', 404));
    }
    contentPlanId = latestPlan._id;
  }

  const slides = await sceneGeneratorService.generateStoryboard(contentPlanId, topic, requestId);

  console.log(`[SceneController] [Request ID: ${requestId}] createScenes successfully completed with ${slides.length} slides.`);
  res.status(200).json({
    success: true,
    contentPlanId,
    slides
  });
});

export const getLatestScenes = catchAsync(async (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  console.log(`[SceneController] [Request ID: ${requestId}] getLatestScenes invoked.`);

  const latestPlan = await ContentPlan.findOne().sort({ createdAt: -1 }).populate('topicId');
  if (!latestPlan) {
    console.warn(`[SceneController] [Request ID: ${requestId}] No content plans found.`);
    return next(new AppError('No content plans found.', 404));
  }

  let slides = await SceneStoryboard.find({ contentPlanId: latestPlan._id }).sort({ slideNumber: 1 });

  if (slides.length === 0) {
    console.log(`[SceneController] [Request ID: ${requestId}] Storyboard slides not found for latest plan ${latestPlan._id}. Triggering storyboard generation...`);
    slides = await sceneGeneratorService.generateStoryboard(latestPlan._id, '', requestId);
  } else {
    console.log(`[SceneController] [Request ID: ${requestId}] Returning existing ${slides.length} slides from DB.`);
  }

  res.status(200).json({
    success: true,
    contentPlanId: latestPlan._id,
    topicTitle: latestPlan.topicId?.title || latestPlan.topicId?.text || '',
    slides
  });
});
