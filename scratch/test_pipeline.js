import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import connectDB from '../src/config/db.js';
import Topic from '../src/models/topic.model.js';
import { runAutomationPipeline } from '../src/jobs/automation.job.js';

// Services to mock if in Mock Mode
import contentPlannerService from '../src/services/contentPlanner.service.js';
import sceneGeneratorService from '../src/services/sceneGenerator.service.js';
import imagePromptService from '../src/services/imagePrompt.service.js';
import imageGeneratorService from '../src/services/imageGenerator.service.js';
import captionService from '../src/services/caption.service.js';
import reelScriptService from '../src/services/reelScript.service.js';
import voiceService from '../src/services/voice.service.js';
import reelService from '../src/services/reel.service.js';
import instagramService from '../src/services/instagram.service.js';

// Parse command line arguments
const args = process.argv.slice(2);
const isLiveMode = args.includes('--live');
const forceFailure = args.includes('--force-failure');

async function runTest() {
  console.log('==================================================');
  console.log('[Pipeline Test] Starting Integration Test Runner');
  console.log(`[Pipeline Test] Mode: ${isLiveMode ? 'LIVE' : 'MOCK'}`);
  console.log('==================================================');

  // Connect to the DB
  await connectDB();

  // Create temporary directories if they don't exist
  const dirs = ['../generated/images', '../generated/audio', '../generated/videos'];
  dirs.forEach(d => {
    const p = path.join(__dirname, d);
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
    }
  });

  const testTopicText = `Why Every Business Needs a Website (Test-${Date.now()})`;

  try {
    // 1) Clean up any existing topics with this exact text (just in case)
    await Topic.deleteOne({ text: testTopicText });

    // 2) Seed a new pending topic
    console.log(`[Pipeline Test] Seeding pending topic: "${testTopicText}"`);
    const seededTopic = await Topic.create({
      text: testTopicText,
      status: 'pending'
    });
    console.log(`[Pipeline Test] Topic seeded successfully. ID: ${seededTopic._id}`);

    // 3) Apply mocks if not in LIVE mode
    if (!isLiveMode) {
      console.log('[Pipeline Test] Overriding services with mock implementations...');
      setupMocks(forceFailure);
    } else {
      console.log('[Pipeline Test] Running with live services. Ensure API keys & credentials are correct in .env.');
    }

    // 4) Execute the pipeline job
    console.log('[Pipeline Test] Triggering runAutomationPipeline()...');
    await runAutomationPipeline();

    // 5) Retrieve and inspect the topic state after pipeline execution
    const updatedTopic = await Topic.findById(seededTopic._id);
    console.log('\n==================================================');
    console.log('[Pipeline Test] Integration Execution Complete');
    console.log('==================================================');
    console.log(`Topic ID:   ${updatedTopic._id}`);
    console.log(`Text:       "${updatedTopic.text}"`);
    console.log(`Status:     ${updatedTopic.status}`);
    console.log(`Media ID:   ${updatedTopic.publishedMediaId || '(None)'}`);
    console.log(`Error Msg:  ${updatedTopic.error || '(None)'}`);
    console.log('==================================================\n');

    // Simple assertions/validations for test output
    if (forceFailure) {
      if (updatedTopic.status === 'failed' && updatedTopic.error.includes('Intentional Pipeline Failure')) {
        console.log('[Pipeline Test SUCCESS] Pipeline failed and logged the error stack as expected.');
      } else {
        console.error('[Pipeline Test FAILURE] Expected status to be "failed" with Intentional error, got status:', updatedTopic.status);
      }
    } else {
      if (updatedTopic.status === 'completed') {
        console.log('[Pipeline Test SUCCESS] Pipeline completed successfully and saved status.');
      } else {
        console.error('[Pipeline Test FAILURE] Expected status to be "completed", got:', updatedTopic.status);
      }
    }

    // Clean up our test record to prevent cluttering local DB
    await Topic.deleteOne({ _id: seededTopic._id });
    console.log('[Pipeline Test] Cleaned up test topic database record.');

  } catch (err) {
    console.error('[Pipeline Test Error] Test runner encountered a fatal exception:', err);
  } finally {
    // Disconnect DB connection to let the process exit
    await mongoose.disconnect();
    console.log('[Pipeline Test] Disconnected from MongoDB. Process exiting.');
  }
}

/**
 * Setup stub/mock methods on service singletons.
 * @param {boolean} triggerFailure - If true, stub a service to throw an error.
 */
function setupMocks(triggerFailure) {
  contentPlannerService.planContent = async (topic) => {
    console.log(`  [MOCK SERVICE] contentPlannerService.planContent("${topic}")`);
    if (triggerFailure) {
      throw new Error('Intentional Pipeline Failure: contentPlannerService simulated error.');
    }
    return {
      industry: 'Business',
      audience: 'Small business owners',
      goal: 'Lead Generation',
      painPoints: ['No online presence', 'Struggling to acquire new customers'],
      benefits: ['Be visible 24/7', 'Capture leads automatically', 'Build professional credibility'],
      contentType: 'reel',
      visualConcepts: [
        'A busy storefront with customers walking past it',
        'A business owner looking worried behind a counter',
        'A laptop screen displaying a beautiful web application landing page',
        'A happy customer shaking hands with the owner',
        'An analytics dashboard showing traffic spikes and leads statistics'
      ]
    };
  };

  sceneGeneratorService.generateScenes = async (plan, topic) => {
    console.log('  [MOCK SERVICE] sceneGeneratorService.generateScenes()');
    return {
      scenes: [
        'Scene 1: Modern retail storefront with warm evening light',
        'Scene 2: Business owner looking stressed checking a smartphone',
        'Scene 3: Laptop screen displaying a web dashboard with upward-trending lead graphs',
        'Scene 4: Happy customer smiling and shaking hands with the business owner',
        'Scene 5: Close up of a clean contact form on a high-converting website screen'
      ]
    };
  };

  imagePromptService.generateImagePrompts = async (scenes) => {
    console.log(`  [MOCK SERVICE] imagePromptService.generateImagePrompts() with ${scenes.length} scenes`);
    return scenes.map(scene => `A photorealistic depiction of the scene: ${scene}, cinematic lighting, f/1.4, vertical 4:5 aspect ratio, professional quality, no text`);
  };

  imageGeneratorService.generateImages = async (prompts) => {
    console.log(`  [MOCK SERVICE] imageGeneratorService.generateImages() with ${prompts.length} prompts`);
    
    // Create mock local placeholder files so paths exist (similar to how actual service creates them)
    const mockImages = [];
    const imagesDir = path.join(__dirname, '../generated/images');
    
    for (let i = 0; i < prompts.length; i++) {
      const mockFilePath = path.join(imagesDir, `mock_test_image_${i + 1}.jpg`);
      // Write a dummy string to act as the file content
      fs.writeFileSync(mockFilePath, 'MOCK_IMAGE_DATA');
      
      mockImages.push({
        localPath: mockFilePath,
        cloudinaryUrl: `https://res.cloudinary.com/demo/image/upload/sample.jpg`
      });
    }
    
    return mockImages;
  };

  captionService.generateCaption = async (topic, audience, benefits) => {
    console.log('  [MOCK SERVICE] captionService.generateCaption()');
    return {
      hook: 'Are you losing customers because you do not have a website?',
      caption: 'In 2026, a business without a website is practically invisible. Having a professional site builds trust, showcases your products, and collects leads 24/7.',
      cta: 'Click the link in my bio to start today!',
      hashtags: ['business', 'marketing', 'website', 'leads', 'growth', 'localbusiness', 'branding', 'seo', 'webdesign', 'entrepreneur', 'smallbusiness', 'sme', 'onlinepresence', 'customers', 'digitalmarketing', 'startup', 'success', 'webdev', 'sales', 'strategy']
    };
  };

  reelScriptService.generateScript = async (topic, audience, benefits) => {
    console.log('  [MOCK SERVICE] reelScriptService.generateScript()');
    return {
      hook: 'Here is why your business is losing customers.',
      body: 'No website means you are invisible online. Get a high-converting site to get leads 24/7.',
      cta: 'Link in bio to get started!'
    };
  };

  voiceService.generateSpeech = async (script) => {
    console.log('  [MOCK SERVICE] voiceService.generateSpeech()');
    const mockAudioPath = path.join(__dirname, '../generated/audio/mock_test_audio.wav');
    fs.writeFileSync(mockAudioPath, 'MOCK_AUDIO_DATA');
    return mockAudioPath;
  };

  reelService.createReel = async (options) => {
    console.log('  [MOCK SERVICE] reelService.createReel() with images:', options.images);
    const mockVideoPath = path.join(__dirname, '../generated/videos/mock_test_video.mp4');
    fs.writeFileSync(mockVideoPath, 'MOCK_VIDEO_DATA');
    return mockVideoPath;
  };

  instagramService.publishReel = async (videoPath, caption) => {
    console.log(`  [MOCK SERVICE] instagramService.publishReel("${videoPath}")`);
    return `ig_mock_media_id_${Date.now()}`;
  };
}

runTest();
