import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

import voiceService from '../src/services/voice.service.js';

async function runTest() {
  const mockReelScript = {
    hook: 'Are you still losing customers to your competitors because you do not have a website?',
    body: 'A professional website gives you twenty-four seven visibility, builds instant trust, and generates high-value leads automatically on autopilot.',
    cta: 'Check the caption and launch your website today!'
  };

  console.log('[Test] Synthesizing speech for Reel script...');
  console.log('Script Data:', JSON.stringify(mockReelScript, null, 2));

  try {
    const outputFilePath = await voiceService.generateSpeech(mockReelScript);
    console.log('[Test] Speech Synthesized successfully!');
    console.log(`Audio saved at: ${outputFilePath}`);
  } catch (error) {
    console.error('[Test Error] Speech synthesis failed:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

runTest();
