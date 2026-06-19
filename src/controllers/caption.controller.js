import captionService from '../services/caption.service.js';
import ContentPlan from '../models/contentPlan.model.js';
import Caption from '../models/caption.model.js';
import AppError from '../utils/appError.js';

const catchAsync = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

export const generateCaption = catchAsync(async (req, res, next) => {
  const { topic, topicId, audience, benefits } = req.body;

  let planData = null;
  let targetTopicId = topicId;

  if (topicId) {
    planData = await ContentPlan.findOne({ topicId });
  }

  if (!planData && audience) {
    planData = { audience, benefits };
  }

  const captionDoc = await captionService.generateAndSaveCaption(topic, planData, targetTopicId);

  res.status(200).json({
    success: true,
    captionId: captionDoc._id,
    hook: captionDoc.hook,
    caption: captionDoc.body,
    cta: captionDoc.cta,
    hashtags: captionDoc.hashtags
  });
});

export const getLatestCaption = catchAsync(async (req, res, next) => {
  const caption = await Caption.findOne().sort({ createdAt: -1 }).populate('topicId');
  if (!caption) {
    return next(new AppError('No captions found.', 404));
  }
  res.status(200).json({
    success: true,
    captionId: caption._id,
    hook: caption.hook,
    caption: caption.body,
    cta: caption.cta,
    hashtags: caption.hashtags,
    topicId: caption.topicId
  });
});
