import { GoogleGenAI } from '@google/genai';
import { SCENE_GENERATION_SYSTEM_INSTRUCTION } from '../prompts/sceneGenerator.prompt.js';
import AppError from '../utils/appError.js';
import { retryWithBackoff, handleServiceError } from '../utils/retry.js';
import ContentPlan from '../models/contentPlan.model.js';
import SceneStoryboard from '../models/sceneStoryboard.model.js';
import { logPipelineEvent } from '../utils/pipelineLogger.js';

class SceneGeneratorService {
  constructor() {
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.activeGenerations = new Map();
  }

  getAIInstance() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AppError('Gemini API is not configured. Please define GEMINI_API_KEY in the environment variables.', 500);
    }
    return new GoogleGenAI({ apiKey });
  }

  /**
   * Generates 5 fallback mock storyboard slides locally and saves them to MongoDB.
   * @param {string} contentPlanId - The content plan ObjectId.
   * @returns {Promise<object[]>} The generated storyboard slide documents.
   */
  async generateMockStoryboard(contentPlanId) {
    const contentPlan = await ContentPlan.findById(contentPlanId).populate('topicId');
    const topicTitle = contentPlan?.topicId?.title || contentPlan?.topicId?.text || 'Unspecified Topic';

    const slides = [
      {
        slideNumber: 1,
        title: `Introduction: ${topicTitle}`,
        description: `Visual overview of "${topicTitle}" tailored for ${contentPlan?.audience || 'target audience'}.`,
        imagePrompt: `A clean, modern setting representing "${topicTitle}". Professional lighting, cozy atmosphere, 3D render style.`
      },
      {
        slideNumber: 2,
        title: `Addressing Main Obstacles`,
        description: `Understanding and solving key pain points: ${Array.isArray(contentPlan?.painPoints) ? contentPlan.painPoints.slice(0, 2).join(', ') : 'common challenges'}.`,
        imagePrompt: `A business professional working at a modern desk looking thoughtful, soft office lighting, high-quality warm photography.`
      },
      {
        slideNumber: 3,
        title: `Key Strategy & Solution`,
        description: `Implement actionable strategies to overcome hurdles and improve conversion rates.`,
        imagePrompt: `A clean, high-tech dashboard showing green upward metrics graphs, soft ambient desk lighting.`
      },
      {
        slideNumber: 4,
        title: `Major Benefits Delivered`,
        description: `Achieve key objectives: ${Array.isArray(contentPlan?.benefits) ? contentPlan.benefits.slice(0, 2).join(', ') : 'improved efficiency and ROI'}.`,
        imagePrompt: `A customer smiling while holding a smartphone with an interface indicating success, bright professional lighting.`
      },
      {
        slideNumber: 5,
        title: `Call to Action`,
        description: `Take action today to kickstart your growth and implement these strategies.`,
        imagePrompt: `A modern smartphone mockup resting on a wooden desk showing a "Get Started" confirmation screen.`
      }
    ];

    // Clear existing
    await SceneStoryboard.deleteMany({ contentPlanId });

    // Save slides to MongoDB
    const slideDocs = [];
    for (const slide of slides) {
      const doc = await SceneStoryboard.create({
        contentPlanId,
        slideNumber: slide.slideNumber,
        title: slide.title,
        description: slide.description,
        imagePrompt: slide.imagePrompt
      });
      slideDocs.push(doc);
    }
    return slideDocs;
  }

  /**
   * Generates 5 structured storyboard slides based on a ContentPlan ID and saves them to MongoDB.
   * @param {string} contentPlanId - The content plan ObjectId.
   * @param {string} [topic] - Optional topic title context.
   * @param {string} [requestId] - Optional request ID for tracking concurrent and duplicate requests.
   * @returns {Promise<object[]>} The generated storyboard slide documents.
   */
  async generateStoryboard(contentPlanId, topic = '', requestId = 'N/A') {
    if (!contentPlanId) {
      throw new AppError('A valid contentPlanId is required.', 400);
    }

    const key = contentPlanId.toString();

    // 1) Concurrency Lock: Check if another request is currently generating for this plan
    if (this.activeGenerations.has(key)) {
      console.log(`[SceneGeneratorService] [Request ID: ${requestId}] Concurrent request detected for contentPlanId ${key}. Re-using active promise...`);
      return this.activeGenerations.get(key);
    }

    const generationPromise = (async () => {
      // 2) Deduplication Check: Return existing slides if they already exist
      const existingSlides = await SceneStoryboard.find({ contentPlanId }).sort({ slideNumber: 1 });
      if (existingSlides.length > 0) {
        console.log(`[SceneGeneratorService] [Request ID: ${requestId}] Storyboard slides already exist for plan ${key}. Returning cached data instead of regenerating.`);
        return existingSlides;
      }

      console.log(`[SceneGeneratorService] [Request ID: ${requestId}] Initiating storyboard generation for plan ${key}`);
      const contentPlan = await ContentPlan.findById(contentPlanId);
      if (!contentPlan) {
        throw new AppError('Content plan not found for scene generation.', 404);
      }

      const topicIdObj = contentPlan.topicId;

      try {
        await logPipelineEvent(topicIdObj, 'Scene Storyboard', 'started', `Initiated storyboard generation. [Request ID: ${requestId}]`);
        const ai = this.getAIInstance();

        const inputContext = {
          topic: topic || 'Unspecified Topic',
          contentPlan
        };

        const response = await retryWithBackoff(() =>
          ai.models.generateContent({
            model: this.model,
            contents: `Input Data:\n${JSON.stringify(inputContext, null, 2)}`,
            config: {
              systemInstruction: SCENE_GENERATION_SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  slides: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        slideNumber: { type: 'INTEGER' },
                        title: { type: 'STRING' },
                        description: { type: 'STRING' },
                        imagePrompt: { type: 'STRING' }
                      },
                      required: ['slideNumber', 'title', 'description', 'imagePrompt']
                    },
                    description: 'List of exactly 5 structured storyboard slides with detailed image prompts.'
                  }
                },
                required: ['slides']
              }
            }
          })
        );

        if (!response.text) {
          throw new Error('Received an empty response from Gemini API.');
        }

        const parsedResponse = JSON.parse(response.text.trim());

        if (!parsedResponse.slides || !Array.isArray(parsedResponse.slides)) {
          throw new Error('Invalid response format: slides field is missing or not an array.');
        }

        // Check and correct slide count
        let slides = parsedResponse.slides;
        if (slides.length !== 5) {
          console.warn(`[SceneGeneratorService Warning] Expected 5 slides, but got ${slides.length}. Padding or slicing.`);
          while (slides.length < 5) {
            const nextIdx = slides.length + 1;
            slides.push({
              slideNumber: nextIdx,
              title: 'Key Insight',
              description: 'An important concept to remember.',
              imagePrompt: 'A placeholder visual scene showing a modern workspace.'
            });
          }
          if (slides.length > 5) {
            slides = slides.slice(0, 5);
          }
        }

        // Clear any existing slides for this plan
        await SceneStoryboard.deleteMany({ contentPlanId });

        // Save each slide to MongoDB
        const slideDocs = [];
        for (const slide of slides) {
          const doc = await SceneStoryboard.create({
            contentPlanId,
            slideNumber: slide.slideNumber,
            title: slide.title,
            description: slide.description,
            imagePrompt: slide.imagePrompt
          });
          slideDocs.push(doc);
        }

        await logPipelineEvent(topicIdObj, 'Scene Storyboard', 'completed', `Successfully generated and saved ${slideDocs.length} storyboard slides.`);
        return slideDocs;
      } catch (error) {
        console.warn(`[SceneGeneratorService] [Request ID: ${requestId}] Storyboard generation failed (Error: ${error.message}). Falling back to local mock generator...`);
        await logPipelineEvent(topicIdObj, 'Scene Storyboard', 'warning', `Generation failed (Error: ${error.message}). Invoking local mock fallback...`);
        
        try {
          const fallbackSlides = await this.generateMockStoryboard(contentPlanId);
          await logPipelineEvent(topicIdObj, 'Scene Storyboard', 'completed', `Successfully generated mock fallback storyboard slides.`);
          return fallbackSlides;
        } catch (fallbackError) {
          console.error(`[SceneGeneratorService] [Request ID: ${requestId}] Mock fallback storyboard generation failed:`, fallbackError.message);
          throw fallbackError;
        }
      }
    })();

    // Store generation promise in Map
    this.activeGenerations.set(key, generationPromise);

    try {
      return await generationPromise;
    } finally {
      // Clear generation tracker when resolved or rejected
      this.activeGenerations.delete(key);
    }
  }
}

export default new SceneGeneratorService();
