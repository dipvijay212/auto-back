import { GoogleGenAI } from '@google/genai';
import { CAPTION_GENERATION_SYSTEM_INSTRUCTION } from '../prompts/caption.prompt.js';
import AppError from '../utils/appError.js';
import { retryWithBackoff, handleServiceError } from '../utils/retry.js';
import Caption from '../models/caption.model.js';
import Topic from '../models/topic.model.js';
import { logPipelineEvent } from '../utils/pipelineLogger.js';

class CaptionService {
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
   * Generates and saves an Instagram caption bundle to MongoDB.
   * @param {string} topicInput - Topic title or text prompt.
   * @param {object} planData - Associated content planner plan info.
   * @param {string} [topicId] - Topic ObjectId.
   * @returns {Promise<object>} Saved Caption document.
   */
  async generateAndSaveCaption(topicInput, planData, topicId = null) {
    let topicDoc = null;
    let topicText = '';

    if (topicId) {
      topicDoc = await Topic.findById(topicId);
    }

    if (!topicDoc && typeof topicInput === 'string' && topicInput.trim() !== '') {
      topicText = topicInput.trim();
      topicDoc = await Topic.findOne({ title: topicText });
      if (!topicDoc) {
        topicDoc = await Topic.create({ title: topicText });
      }
    } else if (topicDoc) {
      topicText = topicDoc.title;
    }

    if (!topicDoc) {
      throw new AppError('A valid topic title or topicId is required to generate a caption.', 400);
    }

    const topicIdObj = topicDoc._id;
    const audience = planData?.audience || 'General audience';
    const benefits = planData?.benefits || '';
    const benefitsText = Array.isArray(benefits) ? benefits.join(', ') : benefits;

    try {
      await logPipelineEvent(topicIdObj, 'Caption Generator', 'started', 'Generating caption copy.');
      const ai = this.getAIInstance();

      const inputContext = {
        topic: topicText.trim(),
        audience: audience.trim(),
        benefits: benefitsText ? benefitsText.trim() : ''
      };

      const response = await retryWithBackoff(() =>
        ai.models.generateContent({
          model: this.model,
          contents: `Input Context:\n${JSON.stringify(inputContext, null, 2)}`,
          config: {
            systemInstruction: CAPTION_GENERATION_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                hook: { type: 'STRING' },
                caption: { type: 'STRING' },
                cta: { type: 'STRING' },
                hashtags: {
                  type: 'ARRAY',
                  items: { type: 'STRING' },
                  description: 'List of exactly 20 relevant hashtags without the # symbol.'
                }
              },
              required: ['hook', 'caption', 'cta', 'hashtags']
            }
          }
        })
      );

      if (!response.text) {
        throw new Error('Received an empty response from Gemini API.');
      }

      const parsedResponse = JSON.parse(response.text.trim());

      // Validate hashtags length
      if (parsedResponse.hashtags && Array.isArray(parsedResponse.hashtags)) {
        if (parsedResponse.hashtags.length !== 20) {
          while (parsedResponse.hashtags.length < 20) {
            parsedResponse.hashtags.push('instagrammarketing');
          }
          if (parsedResponse.hashtags.length > 20) {
            parsedResponse.hashtags = parsedResponse.hashtags.slice(0, 20);
          }
        }
      } else {
        parsedResponse.hashtags = Array(20).fill('instagrammarketing');
      }

      // Clear existing captions for this topic
      await Caption.deleteMany({ topicId: topicIdObj });

      // Save to MongoDB
      const captionDoc = await Caption.create({
        topicId: topicIdObj,
        hook: parsedResponse.hook,
        body: parsedResponse.caption,
        cta: parsedResponse.cta,
        hashtags: parsedResponse.hashtags
      });

      await logPipelineEvent(topicIdObj, 'Caption Generator', 'completed', `Successfully generated and saved caption with ID: ${captionDoc._id}`);
      return captionDoc;
    } catch (error) {
      await logPipelineEvent(topicIdObj, 'Caption Generator', 'failed', `Caption generation failed: ${error.message}`);
      handleServiceError(error, 'Failed to generate caption');
    }
  }
}

export default new CaptionService();
