import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { cloudinary, isConfigured } from '../config/cloudinary.js';
import AppError from '../utils/appError.js';
import GeneratedImage from '../models/generatedImage.model.js';
import ImagePrompt from '../models/imagePrompt.model.js';
import ContentPlan from '../models/contentPlan.model.js';
import SceneStoryboard from '../models/sceneStoryboard.model.js';
import { logPipelineEvent } from '../utils/pipelineLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchWithRetry(url, options = {}, retries = 3, delayMs = 1500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      if (response.status === 429 && attempt < retries) {
        console.warn(`[ImageGeneratorService] Got 429 from Pollinations. Retrying attempt ${attempt}/${retries} in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2;
        continue;
      }
      throw new Error(`Failed to download image from Pollinations AI (Status ${response.status} ${response.statusText})`);
    } catch (err) {
      if (attempt === retries) {
        throw err;
      }
      console.warn(`[ImageGeneratorService] Fetch error on attempt ${attempt}/${retries}: ${err.message}. Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }
}

class ImageGeneratorService {
  constructor() {
    this.outputDir = path.join(__dirname, '../../generated/images');
    // Ensure local directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generates images for an array of prompts from Pollinations AI, saves them locally, uploads to Cloudinary, and persists in MongoDB.
   * @param {object[]|string[]} promptsList - Array of ImagePrompt documents or prompt strings.
   * @returns {Promise<object[]>} Array of saved GeneratedImage documents or { localPath, cloudinaryUrl } objects.
   */
  async generateImages(scenesList) {
    if (!scenesList || !Array.isArray(scenesList)) {
      throw new AppError('Scenes must be an array.', 400);
    }

    if (scenesList.length < 3 || scenesList.length > 5) {
      throw new AppError('The service can only generate between 3 and 5 images at a time.', 400);
    }

    const results = [];

    // Find first scene/prompt doc to extract topicId for logging
    let topicIdObj = null;
    const firstItem = scenesList[0];
    if (firstItem && firstItem.contentPlanId) {
      const plan = await ContentPlan.findById(firstItem.contentPlanId);
      topicIdObj = plan?.topicId;
    } else if (firstItem && firstItem._id) {
      const pDoc = await SceneStoryboard.findById(firstItem._id).populate({
        path: 'contentPlanId',
        select: 'topicId'
      });
      topicIdObj = pDoc?.contentPlanId?.topicId;
    }

    await logPipelineEvent(topicIdObj, 'Image Generator', 'started', `Generating and uploading ${scenesList.length} images.`);

    for (let i = 0; i < scenesList.length; i++) {
      const item = scenesList[i];
      console.log(`[ImageGeneratorService] Processing scene #${i + 1}/${scenesList.length}:`, JSON.stringify(item, null, 2));
      const promptText = item.imagePrompt || item.promptText || (typeof item === 'string' ? item : '');
      const sceneId = item._id || null;

      console.log(`[ImageGeneratorService] Resolved promptText: "${promptText}", sceneId: ${sceneId}`);

      if (!promptText || typeof promptText !== 'string' || promptText.trim() === '') {
        console.error(`[ImageGeneratorService Error] Scene #${i + 1} does not have a valid prompt text!`);
        throw new AppError(`Prompt or scene at index ${i} is not a valid non-empty prompt.`, 400);
      }

      console.log(`[ImageGeneratorService] Generating image ${i + 1}/${scenesList.length} for prompt: "${promptText.substring(0, 60)}..."`);

      if (i > 0) {
        console.log(`[ImageGeneratorService] Spacing requests: Waiting 1000ms before generating next image...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      try {
        // Pollinations AI URL setup (using vertical aspect ratio 4:5 e.g. 1024x1280)
        const seed = crypto.randomInt(100000, 999999);
        const encodedPrompt = encodeURIComponent(promptText.trim());
        const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1280&nologo=true&private=true&seed=${seed}`;

        console.log(`[ImageGeneratorService] Fetching from Pollinations AI: ${pollinationsUrl}`);
        // Fetch image binary buffer with retries
        const response = await fetchWithRetry(pollinationsUrl);
        console.log(`[ImageGeneratorService] Pollinations AI Response Status: ${response.status} (${response.statusText})`);

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        console.log(`[ImageGeneratorService] Image downloaded. Size: ${buffer.length} bytes`);

        // Save locally
        const filename = `image_${Date.now()}_${seed}_${i + 1}.jpg`;
        const localFilePath = path.join(this.outputDir, filename);
        await fs.promises.writeFile(localFilePath, buffer);
        console.log(`[ImageGeneratorService] Image saved locally to: ${localFilePath}`);

        // Store relative path for local retrieval
        const relativeLocalPath = `generated/images/${filename}`;

        let cloudinaryUrl = '';
        let cloudinaryId = '';
        let uploadResult = null;

        console.log(`[ImageGeneratorService] Cloudinary configured status: ${isConfigured}`);
        if (isConfigured) {
          console.log(`[ImageGeneratorService] Uploading image ${i + 1} to Cloudinary...`);
          uploadResult = await cloudinary.uploader.upload(localFilePath, {
            folder: 'instagram_personal_automation/images',
          });
          cloudinaryUrl = uploadResult.secure_url;
          cloudinaryId = uploadResult.public_id;
          console.log(`[ImageGeneratorService] Cloudinary upload successful. Url: ${cloudinaryUrl}`);
        } else {
          console.warn(`[ImageGeneratorService Warning] Cloudinary not configured. Bypassing upload for image ${i + 1}.`);
        }

        let resultObj = null;
        if (sceneId) {
          console.log(`[ImageGeneratorService] Saving GeneratedImage metadata to MongoDB for sceneId: ${sceneId}`);
          // Clear any existing images for this scene
          await GeneratedImage.deleteMany({ sceneId });

          // Save GeneratedImage document
          resultObj = await GeneratedImage.create({
            sceneId,
            imageUrl: cloudinaryUrl || relativeLocalPath,
            localPath: relativeLocalPath,
            cloudinaryId: cloudinaryId || ''
          });
        } else {
          resultObj = {
            localPath: relativeLocalPath,
            cloudinaryUrl,
            prompt: promptText
          };
        }

        const responseObj = resultObj.toObject ? resultObj.toObject() : resultObj;
        responseObj.prompt = promptText;
        results.push(responseObj);

      } catch (error) {
        console.error(`[ImageGeneratorService Error] Failed to generate image for prompt index ${i}:`, error);
        await logPipelineEvent(topicIdObj, 'Image Generator', 'failed', `Failed at prompt ${i + 1}: ${error.message}`);
        throw new AppError(`Image generation failed at prompt index ${i}: ${error.message}`, 500);
      }
    }

    console.log(`[ImageGeneratorService] Completed all generations. Total results: ${results.length}`);
    await logPipelineEvent(topicIdObj, 'Image Generator', 'completed', `Successfully generated and saved ${results.length} images.`);
    return results;
  }
}

export default new ImageGeneratorService();
