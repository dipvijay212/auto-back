import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

import sceneGeneratorService from '../src/services/sceneGenerator.service.js';

async function runTest() {
  const topic = 'Why Every Business Needs a Website';
  
  // Mock content planner output
  const mockContentPlan = {
    industry: "Digital Marketing / Business Services",
    audience: "Local brick-and-mortar business owners",
    goal: "Educate on the value of a digital presence and generate interest in website development services",
    painPoints: [
      "Losing customers to online competitors",
      "Believing a website is too expensive or complex to maintain",
      "Relying solely on word-of-mouth which is slowing down"
    ],
    benefits: [
      "24/7 visibility to potential local customers",
      "Builds credibility and trust with professional branding",
      "Acts as a lead generation machine with low maintenance costs"
    ],
    contentType: "carousel"
  };

  console.log(`[Test] Generating visual scenes for content plan...`);
  console.log('Mock Content Plan:', JSON.stringify(mockContentPlan, null, 2));

  try {
    const response = await sceneGeneratorService.generateScenes(mockContentPlan, topic);
    console.log('[Test] Scene Generation Response:');
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('[Test Error] Failed to generate scenes:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

runTest();
