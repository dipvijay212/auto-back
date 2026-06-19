import { GoogleGenAI } from '@google/genai';
import { IMAGE_BRIEF_SYSTEM_INSTRUCTION } from '../prompts/imageBrief.prompt.js';
import AppError from '../utils/appError.js';
import { retryWithBackoff, handleServiceError } from '../utils/retry.js';
import ImageBrief from '../models/imageBrief.model.js';
import SceneStoryboard from '../models/sceneStoryboard.model.js';
import { logPipelineEvent } from '../utils/pipelineLogger.js';

class ImageBriefService {
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
   * Generates a structured image brief for a single SceneStoryboard slide and saves it to MongoDB.
   * @param {string} sceneId - SceneStoryboard slide ObjectId.
   * @returns {Promise<object>} Saved ImageBrief document.
   */
  async generateBriefForScene(sceneId) {
    if (!sceneId) {
      throw new AppError('sceneId is required to generate an image brief.', 400);
    }

    const sceneDoc = await SceneStoryboard.findById(sceneId).populate({
      path: 'contentPlanId',
      select: 'topicId'
    });

    if (!sceneDoc) {
      throw new AppError('SceneStoryboard document not found.', 404);
    }

    const topicIdObj = sceneDoc.contentPlanId?.topicId;

    try {
      const ai = this.getAIInstance();

      const response = await retryWithBackoff(() =>
        ai.models.generateContent({
          model: this.model,
          contents: `Visual Concept: "${sceneDoc.visualIdea}"\nHeadline: "${sceneDoc.headline}"\nMessage: "${sceneDoc.message}"`,
          config: {
            systemInstruction: IMAGE_BRIEF_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                subject: { type: 'STRING' },
                action: { type: 'STRING' },
                location: { type: 'STRING' },
                mood: { type: 'STRING' },
                style: { type: 'STRING' }
              },
              required: ['subject', 'action', 'location', 'mood', 'style']
            }
          }
        })
      );

      if (!response.text) {
        throw new Error('Received empty response from Gemini API.');
      }

      const brief = JSON.parse(response.text.trim());

      // Clear existing briefs for this scene
      await ImageBrief.deleteMany({ sceneId });

      // Save to MongoDB
      const briefDoc = await ImageBrief.create({
        sceneId,
        subject: brief.subject,
        action: brief.action,
        location: brief.location,
        mood: brief.mood,
        style: brief.style
      });

      return briefDoc;
    } catch (error) {
      await logPipelineEvent(topicIdObj, 'Image Brief Generator', 'failed', `Failed for slide ${sceneDoc.slideNumber}: ${error.message}`);
      handleServiceError(error, `Failed to generate image brief for slide ${sceneDoc.slideNumber}`);
    }
  }

  /**
   * Generates and saves image briefs for a list of SceneStoryboard slides.
   * @param {object[]|string[]} slides - Array of SceneStoryboard documents or slide IDs.
   * @returns {Promise<object[]>} Array of saved ImageBrief documents.
   */
  async generateBriefs(slides) {
    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      throw new AppError('A non-empty list of slides is required.', 400);
    }

    const briefDocs = [];
    const firstDoc = await SceneStoryboard.findById(slides[0]._id || slides[0]).populate({
      path: 'contentPlanId',
      select: 'topicId'
    });
    const topicIdObj = firstDoc?.contentPlanId?.topicId;

    await logPipelineEvent(topicIdObj, 'Image Brief Generator', 'started', `Generating briefs for ${slides.length} slides.`);

    for (const slide of slides) {
      const slideId = slide._id || slide;
      const brief = await this.generateBriefForScene(slideId);
      briefDocs.push(brief);
    }

    await logPipelineEvent(topicIdObj, 'Image Brief Generator', 'completed', `Successfully saved ${briefDocs.length} ImageBrief documents.`);
    return briefDocs;
  }
}

export default new ImageBriefService();
