import imagePromptService from '../services/imagePrompt.service.js';
import imageBriefService from '../services/imageBrief.service.js';
import ContentPlan from '../models/contentPlan.model.js';
import SceneStoryboard from '../models/sceneStoryboard.model.js';
import ImageBrief from '../models/imageBrief.model.js';
import ImagePrompt from '../models/imagePrompt.model.js';
import AppError from '../utils/appError.js';

const catchAsync = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

export const createPrompts = catchAsync(async (req, res, next) => {
  const { contentPlanId } = req.body;

  if (!contentPlanId) {
    return next(new AppError('contentPlanId is required in body.', 400));
  }

  // Find image briefs
  const briefs = await ImageBrief.find().populate({
    path: 'sceneId',
    match: { contentPlanId }
  });

  const filteredBriefs = briefs.filter(b => b.sceneId !== null);
  if (filteredBriefs.length === 0) {
    return next(new AppError('No image briefs found for this content plan.', 404));
  }

  const prompts = await imagePromptService.generatePromptsFromBriefs(filteredBriefs);

  res.status(200).json({
    success: true,
    prompts
  });
});

export const getPromptsForPlan = catchAsync(async (req, res, next) => {
  const { contentPlanId } = req.params;

  const briefs = await ImageBrief.find().populate({
    path: 'sceneId',
    match: { contentPlanId }
  });

  const filteredBriefs = briefs.filter(b => b.sceneId !== null);
  const briefIds = filteredBriefs.map(b => b._id);

  const prompts = await ImagePrompt.find({ imageBriefId: { $in: briefIds } }).populate('imageBriefId');

  res.status(200).json({
    success: true,
    prompts
  });
});

export const getLatestPrompts = catchAsync(async (req, res, next) => {
  const latestPlan = await ContentPlan.findOne().sort({ createdAt: -1 });
  if (!latestPlan) {
    return next(new AppError('No content plans found.', 404));
  }

  // 1) Find briefs
  let briefs = await ImageBrief.find().populate({
    path: 'sceneId',
    match: { contentPlanId: latestPlan._id }
  });
  let filteredBriefs = briefs.filter(b => b.sceneId !== null);

  // 2) If no briefs exist, auto-generate briefs and prompts
  if (filteredBriefs.length === 0) {
    const slides = await SceneStoryboard.find({ contentPlanId: latestPlan._id }).sort({ slideNumber: 1 });
    if (slides.length === 0) {
      return next(new AppError('No storyboard slides found for the latest plan.', 404));
    }
    console.log(`[ImagePromptController] Auto-generating image briefs for plan ${latestPlan._id}...`);
    filteredBriefs = await imageBriefService.generateBriefs(slides);
  }

  // 3) Find prompts
  const briefIds = filteredBriefs.map(b => b._id);
  let prompts = await ImagePrompt.find({ imageBriefId: { $in: briefIds } }).populate('imageBriefId');

  // 4) If no prompts exist, auto-generate prompts
  if (prompts.length === 0) {
    console.log(`[ImagePromptController] Auto-generating image prompts for briefs...`);
    prompts = await imagePromptService.generatePromptsFromBriefs(filteredBriefs);
    // Populate imageBriefId for UI output consistency
    prompts = await ImagePrompt.find({ imageBriefId: { $in: briefIds } }).populate('imageBriefId');
  }

  res.status(200).json({
    success: true,
    contentPlanId: latestPlan._id,
    prompts
  });
});
