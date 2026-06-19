import instagramService from '../services/instagram.service.js';
import PublishedPost from '../models/publishedPost.model.js';
import AppError from '../utils/appError.js';

// Helper to catch exceptions from async operations in express handlers
const catchAsync = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

/**
 * Publish from DB via topicId.
 */
export const publishFromDB = catchAsync(async (req, res, next) => {
  const { topicId } = req.body;

  const publishedPost = await instagramService.publishFromDB(topicId);

  res.status(200).json({
    status: 'success',
    message: 'Media published successfully to Instagram.',
    data: publishedPost
  });
});

/**
 * Publish a single image post to Instagram.
 */
export const publishPost = catchAsync(async (req, res, next) => {
  const { imageUrl, caption } = req.body;

  if (!imageUrl) {
    return next(new AppError('imageUrl is required in body.', 400));
  }

  const mediaId = await instagramService.publishImage(imageUrl, caption);

  res.status(200).json({
    status: 'success',
    message: 'Image post published successfully to Instagram.',
    data: { mediaId }
  });
});

/**
 * Publish a Reel to Instagram.
 */
export const publishReel = catchAsync(async (req, res, next) => {
  const { videoUrl, caption } = req.body;

  if (!videoUrl) {
    return next(new AppError('videoUrl is required in body.', 400));
  }

  const mediaId = await instagramService.publishReel(videoUrl, caption);

  res.status(200).json({
    status: 'success',
    message: 'Reel published successfully to Instagram.',
    data: { mediaId }
  });
});

/**
 * Publish a multi-image Carousel post to Instagram.
 */
export const publishCarousel = catchAsync(async (req, res, next) => {
  const { imageUrls, caption } = req.body;

  if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
    return next(new AppError('imageUrls must be a non-empty array of image paths or URLs.', 400));
  }

  const mediaId = await instagramService.publishCarousel(imageUrls, caption);

  res.status(200).json({
    status: 'success',
    message: 'Carousel post published successfully to Instagram.',
    data: { mediaId }
  });
});

/**
 * Fetch the latest published post record.
 */
export const getLatestPublishedPost = catchAsync(async (req, res, next) => {
  const publishedPost = await PublishedPost.findOne().sort({ createdAt: -1 }).populate('topicId');
  if (!publishedPost) {
    return next(new AppError('No published posts found.', 404));
  }
  res.status(200).json({
    status: 'success',
    data: publishedPost
  });
});

