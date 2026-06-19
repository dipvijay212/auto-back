import PipelineLog from '../models/pipelineLog.model.js';
import AppError from '../utils/appError.js';

const catchAsync = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

export const getPipelineLogs = catchAsync(async (req, res, next) => {
  const logs = await PipelineLog.find()
    .sort({ timestamp: -1 })
    .populate('topicId')
    .limit(100);

  res.status(200).json({
    success: true,
    count: logs.length,
    data: logs
  });
});
