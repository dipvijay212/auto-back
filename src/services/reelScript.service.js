import { GoogleGenAI } from '@google/genai';
import { REEL_SCRIPT_SYSTEM_INSTRUCTION } from '../prompts/reelScript.prompt.js';
import AppError from '../utils/appError.js';
import { retryWithBackoff, handleServiceError } from '../utils/retry.js';
import VoiceScript from '../models/voiceScript.model.js';
import { logPipelineEvent } from '../utils/pipelineLogger.js';

class ReelScriptService {
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
   * Generates a 15-30 second Reels narration script from a Caption document and saves it to MongoDB.
   * @param {object} captionDoc - The Caption document.
   * @returns {Promise<object>} Saved VoiceScript document.
   */
  async generateScriptFromCaption(captionDoc) {
    if (!captionDoc) {
      throw new AppError('A valid Caption document is required to generate a Voice Script.', 400);
    }

    const captionIdObj = captionDoc._id;
    const topicIdObj = captionDoc.topicId;

    try {
      await logPipelineEvent(topicIdObj, 'Voice Script Generator', 'started', 'Generating narration script from Caption.');
      const ai = this.getAIInstance();

      const contentsInput = `Caption Hook: "${captionDoc.hook}"\nCaption Body: "${captionDoc.body}"\nCaption CTA: "${captionDoc.cta}"`;

      const response = await retryWithBackoff(() =>
        ai.models.generateContent({
          model: this.model,
          contents: contentsInput,
          config: {
            systemInstruction: REEL_SCRIPT_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                hook: { type: 'STRING' },
                body: { type: 'STRING' },
                cta: { type: 'STRING' }
              },
              required: ['hook', 'body', 'cta']
            }
          }
        })
      );

      if (!response.text) {
        throw new Error('Received an empty response from Gemini API.');
      }

      const parsed = JSON.parse(response.text.trim());
      const scriptText = `${parsed.hook}. ${parsed.body}. ${parsed.cta}`;

      // Clear existing scripts for this caption
      await VoiceScript.deleteMany({ captionId: captionIdObj });

      // Save to MongoDB
      const scriptDoc = await VoiceScript.create({
        captionId: captionIdObj,
        scriptText
      });

      await logPipelineEvent(topicIdObj, 'Voice Script Generator', 'completed', `Successfully generated and saved VoiceScript document with ID: ${scriptDoc._id}`);
      return scriptDoc;
    } catch (error) {
      await logPipelineEvent(topicIdObj, 'Voice Script Generator', 'failed', `Voice script generation failed: ${error.message}`);
      handleServiceError(error, 'Failed to generate voice script');
    }
  }

  // Backwards compatibility fallback
  async generateScript(topic, audience, benefits = '') {
    try {
      const ai = this.getAIInstance();
      const benefitsText = Array.isArray(benefits) ? benefits.join(', ') : benefits;
      const inputContext = {
        topic: topic.trim(),
        audience: audience.trim(),
        benefits: benefitsText ? benefitsText.trim() : ''
      };

      const response = await retryWithBackoff(() =>
        ai.models.generateContent({
          model: this.model,
          contents: `Input Context:\n${JSON.stringify(inputContext, null, 2)}`,
          config: {
            systemInstruction: REEL_SCRIPT_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                hook: { type: 'STRING' },
                body: { type: 'STRING' },
                cta: { type: 'STRING' }
              },
              required: ['hook', 'body', 'cta']
            }
          }
        })
      );

      return JSON.parse(response.text.trim());
    } catch (error) {
      handleServiceError(error, 'Failed to generate Reel script');
    }
  }
}

export default new ReelScriptService();
