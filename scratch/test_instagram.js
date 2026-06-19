import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

import instagramService from '../src/services/instagram.service.js';

async function runTest() {
  console.log('[Test] Verifying Instagram Graph API Service Configuration...');
  
  try {
    // Attempt credentials validation
    const creds = instagramService.getCredentials();
    console.log('[Test] Environment variables found:');
    console.log(`- INSTAGRAM_ACCOUNT_ID: ${creds.instagramAccountId}`);
    console.log(`- ACCESS_TOKEN: ${creds.accessToken.substring(0, 15)}... (truncated)`);
    
    // Note: End-to-end publishing tests require active external tokens and live public assets.
    // This script successfully verifies that the credentials wrapper is configured.
  } catch (error) {
    console.warn('[Test Warning] Configuration verification failed (Expected if not yet configured by the user):');
    console.warn(error.message);
  }
}

runTest();
