import { GoogleGenAI } from '@google/genai';
import { IMAGE_PROMPT_SYSTEM_INSTRUCTION } from '../prompts/imagePrompt.prompt.js';
import AppError from '../utils/appError.js';
import { retryWithBackoff, handleServiceError } from '../utils/retry.js';
import ImagePrompt from '../models/imagePrompt.model.js';
import ImageBrief from '../models/imageBrief.model.js';
import { logPipelineEvent } from '../utils/pipelineLogger.js';

class ImagePromptService {
  constructor() {
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  getAIInstance() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AppError('Gemini API is not configured. Please define GEMINI_API_KEY in the environment variables.', 500);
    }
    return new GoogleGenAI({ apiKey });
  }

  /**
   * Generates a detailed prompt from an ImageBrief ID and saves it to MongoDB.
   * @param {string} imageBriefId - ImageBrief ObjectId.
   * @returns {Promise<object>} Saved ImagePrompt document.
   */
  async generatePromptFromBrief(imageBriefId) {
    if (!imageBriefId) {
      throw new AppError('imageBriefId is required to generate a prompt.', 400);
    }

    const briefDoc = await ImageBrief.findById(imageBriefId).populate({
      path: 'sceneId',
      populate: {
        path: 'contentPlanId',
        select: 'topicId'
      }
    });

    if (!briefDoc) {
      throw new AppError('ImageBrief document not found.', 404);
    }

    const topicIdObj = briefDoc.sceneId?.contentPlanId?.topicId;

    try {
      const ai = this.getAIInstance();

      const response = await retryWithBackoff(() =>
        ai.models.generateContent({
          model: this.model,
          contents: `Image Brief Input Details:
Subject: "${briefDoc.subject}"
Action: "${briefDoc.action}"
Location: "${briefDoc.location}"
Mood: "${briefDoc.mood}"
Style: "${briefDoc.style}"`,
          config: {
            systemInstruction: IMAGE_PROMPT_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                imagePrompt: {
                  type: 'STRING',
                  description: 'The detailed expanded image prompt optimized for Pollinations AI'
                }
              },
              required: ['imagePrompt']
            }
          }
        })
      );

      if (!response.text) {
        throw new Error('Received an empty response from Gemini API.');
      }

      const parsedResponse = JSON.parse(response.text.trim());

      if (!parsedResponse.imagePrompt) {
        throw new Error('Invalid response format: imagePrompt field is missing.');
      }

      // Clear existing prompts for this brief
      await ImagePrompt.deleteMany({ imageBriefId });

      // Save to MongoDB
      const promptDoc = await ImagePrompt.create({
        imageBriefId,
        promptText: parsedResponse.imagePrompt
      });

      return promptDoc;
    } catch (error) {
      await logPipelineEvent(topicIdObj, 'Image Prompt Generator', 'failed', `Failed for brief ID ${imageBriefId}: ${error.message}`);
      handleServiceError(error, 'Failed to generate image prompt from brief');
    }
  }

  /**
   * Generates detailed prompts from a list of ImageBrief documents/IDs.
   * @param {object[]|string[]} briefs - Array of ImageBrief documents or IDs.
   * @returns {Promise<object[]>} Array of saved ImagePrompt documents.
   */
  async generatePromptsFromBriefs(briefs) {
    if (!briefs || !Array.isArray(briefs) || briefs.length === 0) {
      throw new AppError('A non-empty list of image briefs is required.', 400);
    }

    const promptDocs = [];
    const firstDoc = await ImageBrief.findById(briefs[0]._id || briefs[0]).populate({
      path: 'sceneId',
      populate: {
        path: 'contentPlanId',
        select: 'topicId'
      }
    });
    const topicIdObj = firstDoc?.sceneId?.contentPlanId?.topicId;

    await logPipelineEvent(topicIdObj, 'Image Prompt Generator', 'started', `Generating prompts for ${briefs.length} briefs.`);

    for (const brief of briefs) {
      const briefId = brief._id || brief;
      const promptDoc = await this.generatePromptFromBrief(briefId);
      promptDocs.push(promptDoc);
    }

    await logPipelineEvent(topicIdObj, 'Image Prompt Generator', 'completed', `Successfully saved ${promptDocs.length} ImagePrompt documents.`);
    return promptDocs;
  }
}

export default new ImagePromptService();
