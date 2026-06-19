import Topic from '../models/topic.model.js';
import topicService from '../services/topic.service.js';
import { runAutomationPipeline } from '../jobs/automation.job.js';
import AppError from '../utils/appError.js';

const catchAsync = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

export const getTopics = catchAsync(async (req, res, next) => {
  const topics = await Topic.find().sort({ createdAt: -1 });
  res.status(200).json(topics);
});

export const createTopic = catchAsync(async (req, res, next) => {
  const { title, text, niche, priority, status } = req.body;
  const targetTitle = (title || text || '').trim();

  if (targetTitle === '') {
    return next(new AppError('Topic title/text is required and must be a non-empty string.', 400));
  }

  const existing = await Topic.findOne({ title: targetTitle });
  if (existing) {
    return next(new AppError('This topic is already in the database.', 400));
  }

  const topic = await Topic.create({
    title: targetTitle,
    niche: niche || 'General',
    priority: priority || 'Medium',
    status: status || 'Pending',
    source: 'Manual'
  });

  res.status(201).json(topic);
});

export const updateTopic = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { title, text, niche, priority, status } = req.body;

  const topic = await Topic.findById(id);
  if (!topic) {
    return next(new AppError('Topic not found.', 404));
  }

  if (title !== undefined) topic.title = title;
  else if (text !== undefined) topic.text = text;
  
  if (niche !== undefined) topic.niche = niche;
  if (priority !== undefined) topic.priority = priority;
  if (status !== undefined) topic.status = status;

  await topic.save();

  res.status(200).json({
    success: true,
    data: topic
  });
});

export const deleteTopic = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const topic = await Topic.findByIdAndDelete(id);
  if (!topic) {
    return next(new AppError('Topic not found.', 404));
  }

  res.status(200).json({
    success: true,
    message: 'Topic deleted successfully.'
  });
});

export const generateAITopics = catchAsync(async (req, res, next) => {
  const { niche } = req.body;

  const generated = await topicService.generateAITopics(niche);

  res.status(200).json({
    success: true,
    count: generated.length,
    data: generated
  });
});

export const triggerPipeline = catchAsync(async (req, res, next) => {
  // Trigger pipeline asynchronously (fire and forget)
  runAutomationPipeline().catch(err => {
    console.error('[Manual Trigger Error]', err);
  });

  res.status(200).json({
    success: true,
    message: 'Automation pipeline execution started in the background.'
  });
});

