import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

import reelService from '../src/services/reel.service.js';

async function runTest() {
  const imagesDir = path.join(__dirname, '../generated/images');
  const audioDir = path.join(__dirname, '../generated/audio');
  
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  // 1) Find generated images
  const files = fs.readdirSync(imagesDir);
  const imageFiles = files
    .filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
    .map(f => path.join(imagesDir, f))
    .slice(0, 3); // Take first 3 images

  if (imageFiles.length === 0) {
    console.error('[Test Error] No images found in generated/images/. Run test_generator.js first.');
    process.exit(1);
  }

  console.log('[Test] Found images to compile:', imageFiles);

  const voicePath = path.join(audioDir, 'mock_voice.wav');
  const musicPath = path.join(audioDir, 'mock_music.wav');
  const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';

  try {
    // 2) Generate a mock 12-second silent voiceover wav file
    console.log('[Test] Creating mock voiceover WAV...');
    await execPromise(`"${ffmpegPath}" -f lavfi -i anullsrc=r=44100:cl=mono -t 12 -y "${voicePath}"`);
    console.log('[Test] Mock voiceover created at:', voicePath);

    // 3) Generate a mock 15-second background music sine beep wav file
    console.log('[Test] Creating mock background music...');
    await execPromise(`"${ffmpegPath}" -f lavfi -i sine=frequency=440:duration=15 -y "${musicPath}"`);
    console.log('[Test] Mock music created at:', musicPath);

    // 4) Execute Reel compilation
    console.log('[Test] Compiling Reel video with transitions, music and subtitles...');
    const result = await reelService.createReel({
      images: imageFiles,
      voicePath,
      bgMusicPath: musicPath,
      script: {
        hook: 'Unlock the secret to scaling your local store business.',
        body: 'A professional website puts your store online 24/7, building trust and getting leads automatically.',
        cta: 'Click the link in my bio to start today!'
      }
    });

    console.log('[Test] Reel compiled successfully! Output file:');
    console.log(result);

  } catch (error) {
    console.error('[Test Error] Reel compilation failed:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

runTest();
