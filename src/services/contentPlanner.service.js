import { GoogleGenAI } from '@google/genai';
import { CONTENT_PLANNING_SYSTEM_INSTRUCTION } from '../prompts/contentPlanner.prompt.js';
import AppError from '../utils/appError.js';
import { retryWithBackoff, handleServiceError } from '../utils/retry.js';
import ContentPlan from '../models/contentPlan.model.js';
import Topic from '../models/topic.model.js';
import { logPipelineEvent } from '../utils/pipelineLogger.js';

class ContentPlannerService {
  constructor() {
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  // Get initialized instance of GoogleGenAI SDK lazily
  getAIInstance() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AppError('Gemini API is not configured. Please define GEMINI_API_KEY in the environment variables.', 500);
    }
    return new GoogleGenAI({ apiKey });
  }

  /**
   * Analyze a topic and generate a structured content plan, saving it to MongoDB.
   * @param {string} topicInput - The topic to generate a plan for.
   * @param {string} [topicId] - The associated topic ObjectId.
   * @returns {Promise<object>} The saved ContentPlan document.
   */
  async planContent(topicInput, topicId = null) {
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
      throw new AppError('A valid topic title or topicId is required to generate a plan.', 400);
    }

    const topicIdObj = topicDoc._id;

    try {
      await logPipelineEvent(topicIdObj, 'Content Planner', 'started', `Initiated planning for: "${topicText}"`);
      const ai = this.getAIInstance();
      
      const response = await retryWithBackoff(() =>
        ai.models.generateContent({
          model: this.model,
          contents: `Topic: "${topicText}"`,
          config: {
          systemInstruction: CONTENT_PLANNING_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              industry: { 
                type: 'STRING', 
                description: 'The primary industry this topic relates to' 
              },
              audience: { 
                type: 'STRING', 
                description: 'The specific target audience for this topic' 
              },
              goal: { 
                type: 'STRING', 
                description: 'The core marketing goal of producing content on this topic' 
              },
              painPoints: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: 'Key pain points of the target audience addressed by this topic'
              },
              benefits: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: 'Benefits or solutions that this content will deliver'
              },
              contentType: {
                type: 'STRING',
                description: 'The Instagram content type, e.g., carousel, reel, single-post. If educational/multi-step, default to carousel'
              },
              visualConcepts: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: '5 visual concepts that directly represent the topic based on guidelines'
              }
            },
            required: ['industry', 'audience', 'goal', 'painPoints', 'benefits', 'contentType', 'visualConcepts']
          }
        }
      })
    );

      if (!response.text) {
        throw new Error('Received an empty response from Gemini API.');
      }

      const plan = JSON.parse(response.text.trim());

      // Persist ContentPlan document
      const contentPlanDoc = await ContentPlan.create({
        topicId: topicIdObj,
        industry: plan.industry,
        audience: plan.audience,
        goal: plan.goal,
        painPoints: plan.painPoints,
        benefits: plan.benefits,
        format: plan.contentType || 'carousel',
        visualScript: plan.visualConcepts || []
      });

      await logPipelineEvent(topicIdObj, 'Content Planner', 'completed', `Successfully created ContentPlan document with ID: ${contentPlanDoc._id}`);
      return contentPlanDoc;
    } catch (error) {
      await logPipelineEvent(topicIdObj, 'Content Planner', 'failed', `Content Planner failed: ${error.message}`);
      handleServiceError(error, 'Failed to generate content plan');
    }
  }
}

export default new ContentPlannerService();
