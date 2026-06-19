import reelService from '../services/reel.service.js';
import VideoAsset from '../models/videoAsset.model.js';
import AppError from '../utils/appError.js';

const catchAsync = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

export const generateReel = catchAsync(async (req, res, next) => {
  const { topicId, images, voicePath, script } = req.body;

  // Backwards compatibility fallback if raw inputs are provided
  if (images && voicePath && !topicId) {
    const videoPath = await reelService.createReel({ images, voicePath, script });
    return res.status(200).json({ success: true, videoPath });
  }

  const videoAsset = await reelService.compileReelFromDB(topicId);

  res.status(200).json({
    success: true,
    videoId: videoAsset._id,
    topicId: videoAsset.topicId,
    videoPath: videoAsset.videoPath,
    cloudinaryUrl: videoAsset.cloudinaryUrl,
    duration: videoAsset.duration
  });
});

export const getLatestReel = catchAsync(async (req, res, next) => {
  const videoAsset = await VideoAsset.findOne().sort({ createdAt: -1 }).populate('topicId');
  if (!videoAsset) {
    return next(new AppError('No VideoAsset found.', 404));
  }
  res.status(200).json({
    success: true,
    videoId: videoAsset._id,
    topicId: videoAsset.topicId,
    videoPath: videoAsset.videoPath,
    cloudinaryUrl: videoAsset.cloudinaryUrl,
    duration: videoAsset.duration
  });
});

export const getReels = catchAsync(async (req, res, next) => {
  const reels = await VideoAsset.find().sort({ createdAt: -1 }).populate('topicId');
  res.status(200).json(reels);
});

export const deleteReel = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const reel = await VideoAsset.findByIdAndDelete(id);
  if (!reel) return next(new AppError('Reel not found.', 404));
  res.status(200).json({ success: true, message: 'Reel deleted successfully.' });
});


