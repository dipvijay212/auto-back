import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, exec } from 'child_process';
import AppError from '../utils/appError.js';
import AudioAsset from '../models/audioAsset.model.js';
import VoiceScript from '../models/voiceScript.model.js';
import { logPipelineEvent } from '../utils/pipelineLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class VoiceService {
  constructor() {
    this.outputDir = path.join(__dirname, '../../generated/audio');
    // Ensure directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Helper to query exact audio duration in seconds using ffprobe.
   */
  getAudioDuration(filePath) {
    return new Promise((resolve) => {
      const ffprobePath = process.env.FFPROBE_PATH || 'ffprobe';
      const resolvedPath = path.resolve(filePath);
      exec(`"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${resolvedPath}"`, (err, stdout) => {
        if (err) {
          console.error('[VoiceService ffprobe Error] Failed to read duration:', err.message);
          resolve(0);
        } else {
          const seconds = parseFloat(stdout.trim());
          resolve(isNaN(seconds) ? 0 : seconds);
        }
      });
    });
  }

  /**
   * Synthesizes speech from a VoiceScript document using Piper TTS and saves it as an AudioAsset.
   * @param {object} voiceScriptDoc - Saved VoiceScript document.
   * @returns {Promise<object>} Saved AudioAsset document.
   */
  async synthesizeVoice(voiceScriptDoc) {
    if (!voiceScriptDoc) {
      throw new AppError('A valid VoiceScript document is required.', 400);
    }

    const scriptIdObj = voiceScriptDoc._id;
    const textToSpeak = voiceScriptDoc.scriptText.trim();

    // Query topicId for pipeline logging
    const scriptWithCaption = await VoiceScript.findById(scriptIdObj).populate({
      path: 'captionId',
      select: 'topicId'
    });
    const topicIdObj = scriptWithCaption?.captionId?.topicId;

    if (textToSpeak === '') {
      throw new AppError('Speech text cannot be empty.', 400);
    }

    const piperPath = process.env.PIPER_PATH || 'piper';
    const modelPath = process.env.PIPER_MODEL;

    if (!modelPath) {
      throw new AppError('Piper voice model path is not configured. Please define PIPER_MODEL in your environment variables.', 500);
    }

    const filename = `audio_${Date.now()}.wav`;
    const localFilePath = path.join(this.outputDir, filename);
    const relativeLocalPath = `generated/audio/${filename}`;

    return new Promise((resolve, reject) => {
      logPipelineEvent(topicIdObj, 'Piper TTS', 'started', 'Synthesizing speech via Piper TTS.').catch(console.error);

      // Resolve paths relative to working directory to avoid directory mismatches
      const resolvedModelPath = path.resolve(modelPath);
      const resolvedOutputPath = path.resolve(localFilePath);

      const child = spawn(piperPath, [
        '--model', resolvedModelPath,
        '--output_file', resolvedOutputPath
      ]);

      let stderrData = '';

      child.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      child.on('error', (err) => {
        logPipelineEvent(topicIdObj, 'Piper TTS', 'failed', `TTS process start failed: ${err.message}`).catch(console.error);
        return reject(new AppError(`Failed to start Piper process: ${err.message}. Ensure PIPER_PATH is correct.`, 500));
      });

      child.on('close', async (code) => {
        if (code === 0) {
          try {
            // Get actual duration using ffprobe
            const duration = await this.getAudioDuration(localFilePath);

            // Clear existing audio assets for this script
            await AudioAsset.deleteMany({ scriptId: scriptIdObj });

            // Create AudioAsset record
            const audioAssetDoc = await AudioAsset.create({
              scriptId: scriptIdObj,
              audioPath: relativeLocalPath,
              duration
            });

            await logPipelineEvent(topicIdObj, 'Piper TTS', 'completed', `Speech synthesized successfully: ${relativeLocalPath} (Duration: ${duration}s)`);
            resolve(audioAssetDoc);
          } catch (dbErr) {
            reject(new AppError(`Failed to save AudioAsset: ${dbErr.message}`, 500));
          }
        } else {
          await logPipelineEvent(topicIdObj, 'Piper TTS', 'failed', `TTS synthesis process failed with exit code ${code}`);
          reject(new AppError(`Piper TTS failed with exit code ${code}. Stderr: ${stderrData.trim()}`, 500));
        }
      });

      // Write text into standard input of the Piper process
      child.stdin.write(textToSpeak);
      child.stdin.end();
    });
  }

  // Backwards compatibility fallback method
  async generateSpeech(reelScript) {
    if (!reelScript) {
      throw new AppError('Reel script or text is required for voice synthesis.', 400);
    }

    let textToSpeak = '';
    if (typeof reelScript === 'object') {
      const parts = [];
      if (reelScript.hook) parts.push(reelScript.hook.trim());
      if (reelScript.body) parts.push(reelScript.body.trim());
      if (reelScript.cta) parts.push(reelScript.cta.trim());
      textToSpeak = parts.join('. ');
    } else if (typeof reelScript === 'string') {
      textToSpeak = reelScript.trim();
    }

    const piperPath = process.env.PIPER_PATH || 'piper';
    const modelPath = process.env.PIPER_MODEL;

    if (!modelPath) {
      throw new AppError('Piper voice model path is not configured. Please define PIPER_MODEL in your environment variables.', 500);
    }

    const filename = `audio_fallback_${Date.now()}.wav`;
    const localFilePath = path.join(this.outputDir, filename);
    const relativeLocalPath = `generated/audio/${filename}`;

    return new Promise((resolve, reject) => {
      const resolvedModelPath = path.resolve(modelPath);
      const resolvedOutputPath = path.resolve(localFilePath);

      const child = spawn(piperPath, [
        '--model', resolvedModelPath,
        '--output_file', resolvedOutputPath
      ]);

      child.on('error', (err) => reject(new AppError(`Piper failed: ${err.message}`, 500)));
      child.on('close', (code) => {
        if (code === 0) resolve(relativeLocalPath);
        else reject(new AppError(`Piper exited with code ${code}`, 500));
      });

      child.stdin.write(textToSpeak);
      child.stdin.end();
    });
  }
}

export default new VoiceService();
