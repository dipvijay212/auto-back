import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

import imageGeneratorService from '../src/services/imageGenerator.service.js';

async function runTest() {
  const prompts = [
    'A professional photo of a modern retail store with customers entering, warm sunlight, f/1.4, vertical 4:5 aspect ratio, clean composition, no text, no watermark',
    'A corporate office setup with business owners discussing website analytics on a monitor screen, photorealistic style, vertical 4:5 aspect ratio, clean composition, no text, no watermark',
    'A customer browsing on a smartphone in a cozy cafe, professional composition, cinematic lighting, vertical 4:5 aspect ratio, clean composition, no text, no watermark'
  ];

  console.log('[Test] Generating images from mock prompts...');
  console.log('Prompts:', JSON.stringify(prompts, null, 2));

  try {
    const results = await imageGeneratorService.generateImages(prompts);
    console.log('[Test] Success! Generated images results:');
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('[Test Error] Failed to generate images:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

runTest();
