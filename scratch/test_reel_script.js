import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

import reelScriptService from '../src/services/reelScript.service.js';

async function runTest() {
  const topic = 'Why Every Business Needs a Website';
  const audience = 'Local brick-and-mortar business owners';
  const benefits = [
    '24/7 visibility to potential local customers',
    'Builds credibility and trust with professional branding',
    'Acts as a lead generation machine with low maintenance costs'
  ];

  console.log(`[Test] Generating Reel script for topic: "${topic}"...`);

  try {
    const response = await reelScriptService.generateScript(topic, audience, benefits);
    console.log('[Test] Reel Script Response:');
    console.log(JSON.stringify(response, null, 2));

    const totalWordCount = (response.hook.split(' ').length) + 
                          (response.body.split(' ').length) + 
                          (response.cta.split(' ').length);
    console.log(`[Test] Estimated Script Word Count: ${totalWordCount} words (Expected: 40-75 words)`);
  } catch (error) {
    console.error('[Test Error] Failed to generate Reel script:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

runTest();
