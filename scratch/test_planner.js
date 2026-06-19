import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the environment variables from the parent directory
dotenv.config({ path: path.join(__dirname, '../.env') });

import contentPlannerService from '../src/services/contentPlanner.service.js';

async function runTest() {
  const topic = 'Why Every Business Needs a Website';
  console.log(`[Test] Planning content for topic: "${topic}"...`);
  
  try {
    const plan = await contentPlannerService.planContent(topic);
    console.log('[Test] Content Plan Generated successfully:');
    console.log(JSON.stringify(plan, null, 2));
  } catch (error) {
    console.error('[Test Error] Failed to generate plan:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

runTest();
