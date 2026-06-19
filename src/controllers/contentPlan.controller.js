import contentPlannerService from '../services/contentPlanner.service.js';
import ContentPlan from '../models/contentPlan.model.js';
import AppError from '../utils/appError.js';

const catchAsync = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

export const createPlan = catchAsync(async (req, res, next) => {
  const { topic, topicId } = req.body;

  if (!topic && !topicId) {
    return next(new AppError('topic or topicId is required in body.', 400));
  }

  const contentPlan = await contentPlannerService.planContent(topic, topicId);

  res.status(200).json({
    success: true,
    contentPlanId: contentPlan._id,
    data: contentPlan
  });
});

export const getLatestPlan = catchAsync(async (req, res, next) => {
  const contentPlan = await ContentPlan.findOne().sort({ createdAt: -1 }).populate('topicId');
  if (!contentPlan) {
    return next(new AppError('No content plans found.', 404));
  }
  res.status(200).json(contentPlan);
});
