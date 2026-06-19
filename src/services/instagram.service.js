import fs from 'fs';
import path from 'path';
import { cloudinary, isConfigured as isCloudinaryConfigured } from '../config/cloudinary.js';
import AppError from '../utils/appError.js';
import Topic from '../models/topic.model.js';
import VideoAsset from '../models/videoAsset.model.js';
import GeneratedImage from '../models/generatedImage.model.js';
import Caption from '../models/caption.model.js';
import PublishedPost from '../models/publishedPost.model.js';
import ContentPlan from '../models/contentPlan.model.js';
import SceneStoryboard from '../models/sceneStoryboard.model.js';
import ImageBrief from '../models/imageBrief.model.js';
import ImagePrompt from '../models/imagePrompt.model.js';
import { logPipelineEvent } from '../utils/pipelineLogger.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class InstagramService {
  constructor() {
    this.graphBaseUrl = 'https://graph.facebook.com/v20.0';
  }

  // Helper to ensure Instagram configurations are present
  getCredentials() {
    const instagramAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
    const accessToken = process.env.ACCESS_TOKEN;

    if (!instagramAccountId || !accessToken) {
      throw new AppError('Instagram configurations (INSTAGRAM_ACCOUNT_ID, ACCESS_TOKEN) are missing in environment variables.', 500);
    }

    return { instagramAccountId, accessToken };
  }

  // Helper to check if string is a public URL
  isPublicUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  // Upload local asset to Cloudinary if necessary and retrieve secure url
  async getPublicUrl(assetPathOrUrl, resourceType = 'image') {
    if (this.isPublicUrl(assetPathOrUrl)) {
      return assetPathOrUrl;
    }

    // Attempt local file resolution
    const resolvedPath = path.resolve(assetPathOrUrl);
    if (!fs.existsSync(resolvedPath)) {
      throw new AppError(`Asset file not found locally: ${assetPathOrUrl}`, 400);
    }

    if (!isCloudinaryConfigured) {
      throw new AppError(`Publishing requires public HTTP URLs. Local file '${assetPathOrUrl}' cannot be uploaded because Cloudinary is not configured.`, 500);
    }

    try {
      console.log(`[InstagramService] Uploading local asset '${assetPathOrUrl}' to Cloudinary...`);
      const result = await cloudinary.uploader.upload(resolvedPath, {
        resource_type: resourceType,
        folder: 'instagram_personal_automation/publish'
      });
      return result.secure_url;
    } catch (error) {
      console.error(`[InstagramService Cloudinary Upload Error]`, error);
      throw new AppError(`Failed to upload local asset to Cloudinary: ${error.message}`, 500);
    }
  }

  // Helper to call Facebook Graph API
  async callGraphApi(endpoint, options = {}) {
    const method = options.method || 'GET';
    const params = options.params || {};
    
    const url = new URL(`${this.graphBaseUrl}/${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    try {
      const response = await fetch(url.toString(), { method });
      const data = await response.json();
      
      if (!response.ok) {
        console.error(`[InstagramService Graph API Error Response]`, data);
        throw new Error(data.error?.message || `Facebook Graph API error status ${response.status}`);
      }
      return data;
    } catch (error) {
      console.error(`[InstagramService Network/API Error] URL: ${url.toString()}`, error);
      throw new AppError(`Instagram Graph API request failed: ${error.message}`, 502);
    }
  }

  /**
   * Publishes a single image to Instagram.
   * @param {string} imagePathOrUrl - Local path or public URL of the image.
   * @param {string} caption - The caption for the post.
   * @returns {Promise<string>} The published media ID.
   */
  async publishImage(imagePathOrUrl, caption) {
    const { instagramAccountId, accessToken } = this.getCredentials();
    
    // Resolve public URL (uploads to Cloudinary if local)
    const imageUrl = await this.getPublicUrl(imagePathOrUrl, 'image');
    console.log(`[InstagramService] Creating image container for: ${imageUrl}`);

    // Step 1: Create media container
    const containerData = await this.callGraphApi(`${instagramAccountId}/media`, {
      method: 'POST',
      params: {
        image_url: imageUrl,
        caption: caption || '',
        access_token: accessToken
      }
    });

    const creationId = containerData.id;
    console.log(`[InstagramService] Image container created: ${creationId}. Publishing...`);

    // Step 2: Publish media container
    const publishData = await this.callGraphApi(`${instagramAccountId}/media_publish`, {
      method: 'POST',
      params: {
        creation_id: creationId,
        access_token: accessToken
      }
    });

    console.log(`[InstagramService] Image post published successfully! Media ID: ${publishData.id}`);
    return publishData.id;
  }

  /**
   * Publishes a carousel (multi-image post) to Instagram.
   * @param {string[]} images - Array of local paths or public URLs of the images.
   * @param {string} caption - The caption for the post.
   * @returns {Promise<string>} The published media ID.
   */
  async publishCarousel(images, caption) {
    if (!images || !Array.isArray(images) || images.length < 2 || images.length > 10) {
      throw new AppError('Instagram carousels require an array of 2 to 10 images.', 400);
    }

    const { instagramAccountId, accessToken } = this.getCredentials();
    const childrenIds = [];

    // Step 1: Create media item containers for each child
    for (let i = 0; i < images.length; i++) {
      const imageUrl = await this.getPublicUrl(images[i], 'image');
      console.log(`[InstagramService] Creating carousel item container ${i + 1}/${images.length} for: ${imageUrl}`);

      const itemContainer = await this.callGraphApi(`${instagramAccountId}/media`, {
        method: 'POST',
        params: {
          image_url: imageUrl,
          is_carousel_item: 'true',
          access_token: accessToken
        }
      });
      childrenIds.push(itemContainer.id);
    }

    // Step 2: Create parent carousel container
    console.log('[InstagramService] Creating parent carousel container...');
    const parentContainer = await this.callGraphApi(`${instagramAccountId}/media`, {
      method: 'POST',
      params: {
        media_type: 'CAROUSEL',
        children: childrenIds.join(','),
        caption: caption || '',
        access_token: accessToken
      }
    });

    const creationId = parentContainer.id;
    console.log(`[InstagramService] Carousel parent container created: ${creationId}. Publishing...`);

    // Step 3: Publish parent carousel container
    const publishData = await this.callGraphApi(`${instagramAccountId}/media_publish`, {
      method: 'POST',
      params: {
        creation_id: creationId,
        access_token: accessToken
      }
    });

    console.log(`[InstagramService] Carousel published successfully! Media ID: ${publishData.id}`);
    return publishData.id;
  }

  /**
   * Publishes a Reel (video) to Instagram.
   * @param {string} videoPathOrUrl - Local path or public URL of the video.
   * @param {string} caption - The caption for the Reel.
   * @returns {Promise<string>} The published media ID.
   */
  async publishReel(videoPathOrUrl, caption) {
    const { instagramAccountId, accessToken } = this.getCredentials();

    // Resolve public URL (uploads to Cloudinary if local)
    const videoUrl = await this.getPublicUrl(videoPathOrUrl, 'video');
    console.log(`[InstagramService] Creating video container for Reel: ${videoUrl}`);

    // Step 1: Create Reels media container
    const containerData = await this.callGraphApi(`${instagramAccountId}/media`, {
      method: 'POST',
      params: {
        media_type: 'REELS',
        video_url: videoUrl,
        caption: caption || '',
        share_to_feed: 'true',
        access_token: accessToken
      }
    });

    const creationId = containerData.id;
    console.log(`[InstagramService] Reels container created: ${creationId}. Waiting for video processing...`);

    // Step 2: Poll container status until FINISHED
    let status = 'IN_PROGRESS';
    let attempts = 0;
    const maxAttempts = 15; // 15 attempts * 6 seconds = 90 seconds max timeout

    while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
      await sleep(6000); // Wait 6 seconds between polls
      attempts++;
      
      console.log(`[InstagramService] Polling container status (Attempt ${attempts}/${maxAttempts})...`);
      const statusData = await this.callGraphApi(creationId, {
        params: {
          fields: 'status_code',
          access_token: accessToken
        }
      });

      status = statusData.status_code;
      console.log(`[InstagramService] Container status: ${status}`);

      if (status === 'FINISHED') {
        break;
      }
      if (status === 'ERROR') {
        throw new AppError('Instagram failed to process the video file.', 500);
      }
    }

    if (status !== 'FINISHED') {
      throw new AppError('Video processing timed out on Instagram servers.', 504);
    }

    // Step 3: Publish Reels container
    console.log(`[InstagramService] Reel video finished processing. Publishing...`);
    const publishData = await this.callGraphApi(`${instagramAccountId}/media_publish`, {
      method: 'POST',
      params: {
        creation_id: creationId,
        access_token: accessToken
      }
    });

    console.log(`[InstagramService] Reel published successfully! Media ID: ${publishData.id}`);
    return publishData.id;
  }

  /**
   * Publishes media associated with a topic from MongoDB to Instagram.
   * @param {string} [topicId] - The ID of the topic. If not provided, uses the latest topic.
   * @returns {Promise<object>} The saved PublishedPost document.
   */
  async publishFromDB(topicId) {
    let targetTopicId = topicId;
    let topic = null;

    if (targetTopicId) {
      topic = await Topic.findById(targetTopicId);
    } else {
      topic = await Topic.findOne().sort({ createdAt: -1 });
    }

    if (!topic) {
      throw new AppError('No Topic found to publish.', 404);
    }
    targetTopicId = topic._id;

    await logPipelineEvent(targetTopicId, 'Instagram Publisher', 'started', `Starting Instagram publishing for topic: "${topic.title}"`);

    // Fetch the caption
    const caption = await Caption.findOne({ topicId: targetTopicId });
    let captionText = '';
    if (caption) {
      const hashtagsStr = (caption.hashtags || []).map(h => h.startsWith('#') ? h : `#${h}`).join(' ');
      captionText = `${caption.hook}\n\n${caption.body}\n\n${caption.cta}\n\n${hashtagsStr}`;
    }

    // Try finding VideoAsset (Reel) first
    const videoAsset = await VideoAsset.findOne({ topicId: targetTopicId });
    let mediaId = '';
    let mediaType = 'REEL';

    if (videoAsset) {
      const videoPath = videoAsset.cloudinaryUrl || videoAsset.videoPath;
      mediaId = await this.publishReel(videoPath, captionText);
      mediaType = 'VIDEO';
    } else {
      // Fallback: Find GeneratedImages
      const contentPlan = await ContentPlan.findOne({ topicId: targetTopicId });
      if (!contentPlan) {
        throw new AppError('No VideoAsset or ContentPlan found for this topic.', 404);
      }

      const scenes = await SceneStoryboard.find({ contentPlanId: contentPlan._id }).sort({ slideNumber: 1 });
      if (scenes.length === 0) {
        throw new AppError('No SceneStoryboard slides found for this content plan.', 404);
      }

      const sceneIds = scenes.map(s => s._id);
      const briefs = await ImageBrief.find({ sceneId: { $in: sceneIds } });
      const briefIds = briefs.map(b => b._id);
      const prompts = await ImagePrompt.find({ imageBriefId: { $in: briefIds } });
      
      const promptToSceneMap = {};
      for (const brief of briefs) {
        const prompt = prompts.find(p => p.imageBriefId.toString() === brief._id.toString());
        if (prompt) {
          promptToSceneMap[prompt._id.toString()] = brief.sceneId.toString();
        }
      }

      const generatedImages = await GeneratedImage.find({ promptId: { $in: Object.keys(promptToSceneMap) } });
      const sceneToImageMap = {};
      for (const img of generatedImages) {
        const sceneId = promptToSceneMap[img.promptId.toString()];
        sceneToImageMap[sceneId] = img;
      }

      const imageUrlsOrPaths = [];
      for (const scene of scenes) {
        const img = sceneToImageMap[scene._id.toString()];
        if (img) {
          imageUrlsOrPaths.push(img.imageUrl || img.localPath);
        }
      }

      if (imageUrlsOrPaths.length === 0) {
        throw new AppError('No media found to publish for this topic.', 404);
      }

      if (imageUrlsOrPaths.length === 1) {
        mediaId = await this.publishImage(imageUrlsOrPaths[0], captionText);
        mediaType = 'IMAGE';
      } else {
        mediaId = await this.publishCarousel(imageUrlsOrPaths, captionText);
        mediaType = 'CAROUSEL';
      }
    }

    // Save PublishedPost record
    const publishedPost = await PublishedPost.create({
      topicId: targetTopicId,
      instagramPostId: mediaId,
      mediaType,
      publishedAt: new Date()
    });

    // Update Topic Status
    topic.status = 'Published';
    topic.publishedMediaId = mediaId;
    await topic.save();

    await logPipelineEvent(targetTopicId, 'Instagram Publisher', 'completed', `Successfully published ${mediaType} to Instagram with Media ID: ${mediaId}`);

    return publishedPost;
  }
}

export default new InstagramService();
