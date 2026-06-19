import imageBriefService from '../services/imageBrief.service.js';
import SceneStoryboard from '../models/sceneStoryboard.model.js';
import ImageBrief from '../models/imageBrief.model.js';
import AppError from '../utils/appError.js';

const catchAsync = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

export const createBriefs = catchAsync(async (req, res, next) => {
  const { contentPlanId } = req.body;

  if (!contentPlanId) {
    return next(new AppError('contentPlanId is required in body.', 400));
  }

  // 1) Find slides for the ContentPlan
  const slides = await SceneStoryboard.find({ contentPlanId }).sort({ slideNumber: 1 });
  if (slides.length === 0) {
    return next(new AppError('No storyboard slides found for the content plan.', 404));
  }

  // 2) Generate brief documents
  const briefs = await imageBriefService.generateBriefs(slides);

  res.status(200).json({
    success: true,
    briefs
  });
});

export const getBriefsForPlan = catchAsync(async (req, res, next) => {
  const { contentPlanId } = req.params;

  const slides = await SceneStoryboard.find({ contentPlanId });
  const slideIds = slides.map(s => s._id);

  const briefs = await ImageBrief.find({ sceneId: { $in: slideIds } }).populate('sceneId');

  res.status(200).json({
    success: true,
    briefs
  });
});
