import { GoogleGenAI } from '@google/genai';
import AppError from '../utils/appError.js';
import { retryWithBackoff, handleServiceError } from '../utils/retry.js';
import Topic from '../models/topic.model.js';

class TopicService {
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
   * Generates 20 trending topics for a given niche using Gemini and saves them to MongoDB.
   * @param {string} niche - The niche to generate topics for.
   * @returns {Promise<object[]>} Saved Topic documents.
   */
  async generateAITopics(niche = 'General') {
    try {
      const ai = this.getAIInstance();
      const prompt = `Generate 20 trending, high-engagement topics for the niche: "${niche}". Make them specific and perfect for Instagram reels or posts.`;

      const systemInstruction = `You are a social media growth expert. Generate exactly 20 highly viral-potential, specific, and engaging topics for the given niche.
Provide a priority rating ('Low', 'Medium', or 'High') for each topic indicating how relevant/trending it is right now.`;

      const response = await retryWithBackoff(() =>
        ai.models.generateContent({
          model: this.model,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                topics: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      title: { type: 'STRING' },
                      priority: { type: 'STRING', enum: ['Low', 'Medium', 'High'] }
                    },
                    required: ['title', 'priority']
                  }
                }
              },
              required: ['topics']
            }
          }
        })
      );

      if (!response.text) {
        throw new Error('Received an empty response from Gemini API.');
      }

      const parsed = JSON.parse(response.text.trim());
      const savedTopics = [];

      for (const item of parsed.topics) {
        const titleTrimmed = item.title.trim();
        // Check duplicate
        const existing = await Topic.findOne({ title: titleTrimmed });
        if (existing) continue;

        const topicDoc = await Topic.create({
          title: titleTrimmed,
          niche,
          priority: item.priority || 'Medium',
          status: 'Pending',
          source: 'AI Generator'
        });
        savedTopics.push(topicDoc);
      }

      return savedTopics;
    } catch (error) {
      handleServiceError(error, 'Failed to generate AI topics');
    }
  }
}

export default new TopicService();
