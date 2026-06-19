import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

import imagePromptService from '../src/services/imagePrompt.service.js';

async function runTest() {
  const scene = 'Business owner receiving website leads';
  console.log(`[Test] Generating detailed image prompt for scene: "${scene}"...`);

  try {
    const response = await imagePromptService.generateImagePrompt(scene);
    console.log('[Test] Image Prompt Response:');
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('[Test Error] Failed to generate image prompt:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

runTest();
