import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

import captionService from '../src/services/caption.service.js';

async function runTest() {
  const topic = 'Why Every Business Needs a Website';
  const audience = 'Local brick-and-mortar business owners';
  const benefits = [
    '24/7 visibility to potential local customers',
    'Builds credibility and trust with professional branding',
    'Acts as a lead generation machine with low maintenance costs'
  ];

  console.log(`[Test] Generating caption bundle for topic: "${topic}"...`);

  try {
    const response = await captionService.generateCaption(topic, audience, benefits);
    console.log('[Test] Caption Response:');
    console.log(JSON.stringify(response, null, 2));
    if (response.hashtags) {
      console.log(`[Test] Hashtag Count: ${response.hashtags.length} (Expected: 20)`);
    }
  } catch (error) {
    console.error('[Test Error] Failed to generate caption:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

runTest();
