import AutomationConfig from '../models/automationConfig.model.js';
import AutomationLog from '../models/automationLog.model.js';
import { rescheduleJob } from '../jobs/automation.job.js';
import AppError from '../utils/appError.js';

const catchAsync = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

export const getConfig = catchAsync(async (req, res, next) => {
  let config = await AutomationConfig.findOne();
  if (!config) {
    config = await AutomationConfig.create({
      enabled: true,
      schedule: ["9 AM", "2 PM", "7 PM"]
    });
  }

  // Fetch last 50 execution logs
  const logs = await AutomationLog.find().sort({ timestamp: -1 }).limit(50);

  const formattedLogs = logs.map(l => ({
    id: l._id,
    timestamp: new Date(l.timestamp).toLocaleString(),
    level: l.level,
    message: l.message
  }));

  res.status(200).json({
    enabled: config.enabled,
    schedule: config.schedule,
    logs: formattedLogs
  });
});

export const updateConfig = catchAsync(async (req, res, next) => {
  const { enabled, schedule } = req.body;

  if (enabled === undefined) {
    return next(new AppError('enabled is required in body.', 400));
  }
  if (!schedule || !Array.isArray(schedule)) {
    return next(new AppError('schedule array is required in body.', 400));
  }

  let config = await AutomationConfig.findOne();
  if (!config) {
    config = new AutomationConfig();
  }

  config.enabled = enabled;
  config.schedule = schedule;
  await config.save();

  // Reschedule cron task dynamically
  await rescheduleJob();

  res.status(200).json({ success: true });
});
