import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import AppError from '../utils/appError.js';
import VideoAsset from '../models/videoAsset.model.js';
import ContentPlan from '../models/contentPlan.model.js';
import SceneStoryboard from '../models/sceneStoryboard.model.js';
import ImageBrief from '../models/imageBrief.model.js';
import ImagePrompt from '../models/imagePrompt.model.js';
import GeneratedImage from '../models/generatedImage.model.js';
import Caption from '../models/caption.model.js';
import VoiceScript from '../models/voiceScript.model.js';
import AudioAsset from '../models/audioAsset.model.js';
import { logPipelineEvent } from '../utils/pipelineLogger.js';
import { cloudinary, isConfigured as isCloudinaryConfigured } from '../config/cloudinary.js';

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ReelService {
  constructor() {
    this.outputDir = path.join(__dirname, '../../generated/videos');
    // Ensure local directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // Get audio duration using ffprobe
  async getAudioDuration(filePath) {
    const ffprobePath = process.env.FFPROBE_PATH || 'ffprobe';
    try {
      const command = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${path.resolve(filePath)}"`;
      const { stdout } = await execPromise(command);
      const duration = parseFloat(stdout.trim());
      if (isNaN(duration)) {
        throw new Error('ffprobe returned an invalid duration value.');
      }
      return duration;
    } catch (error) {
      console.error(`[ReelService ffprobe error]`, error.message);
      return 15.0; // fallback default
    }
  }

  // Escape subtitle file path for FFmpeg VF filter (crucial for Windows filesystem paths)
  escapeSubtitlesPath(filePath) {
    // Use relative path to avoid drive letters (colons) which break FFmpeg option parsing on Windows
    let p = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    return p;
  }

  // Format seconds to SRT subtitle timing format: HH:MM:SS,mmm
  formatSRTTime(seconds) {
    const pad = (num, size) => ('000' + num).slice(-size);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
  }

  // Write subtitle records into a temporary SRT file
  createSRTFile(subtitles, outputPath) {
    let content = '';
    subtitles.forEach((sub, index) => {
      content += `${index + 1}\n`;
      content += `${this.formatSRTTime(sub.start)} --> ${this.formatSRTTime(sub.end)}\n`;
      content += `${sub.text}\n\n`;
    });
    fs.writeFileSync(outputPath, content, 'utf8');
  }

  /**
   * Compiles images, voiceover, and optional bg music into a 9:16 Instagram Reel.
   * @param {object} params
   * @param {string[]} params.images - Array of local image paths.
   * @param {string} params.voicePath - Local path to the voice WAV file.
   * @param {string} [params.bgMusicPath] - Optional path to the background music file.
   * @param {object[]} [params.subtitles] - Optional custom subtitles: [{ text, start, end }]
   * @param {object} [params.script] - Optional script for fallback subtitles: { hook, body, cta }
   * @returns {Promise<string>} Relative path to the generated MP4 file.
   */
  async createReel({ images, voicePath, bgMusicPath, subtitles, script }) {
    if (!images || !Array.isArray(images) || images.length === 0) {
      throw new AppError('Images array is required and must not be empty.', 400);
    }
    if (!voicePath) {
      throw new AppError('Voiceover audio path is required.', 400);
    }

    const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';

    try {
      // 1) Get voiceover duration
      const duration = await this.getAudioDuration(voicePath);
      console.log(`[ReelService] Voiceover duration detected: ${duration}s`);

      // 2) Calculate timings
      const numImages = images.length;
      const displayDuration = duration / numImages;

      // 3) Handle subtitles
      let finalSubtitles = [];
      if (subtitles && Array.isArray(subtitles)) {
        finalSubtitles = subtitles;
      } else if (script) {
        // Generate default timings from script parts
        const hookEnd = duration * 0.25;
        const bodyEnd = duration * 0.80;
        
        if (script.hook) {
          finalSubtitles.push({ text: script.hook, start: 0, end: hookEnd });
        }
        if (script.body) {
          finalSubtitles.push({ text: script.body, start: hookEnd, end: bodyEnd });
        }
        if (script.cta) {
          finalSubtitles.push({ text: script.cta, start: bodyEnd, end: duration });
        }
      }

      const tempSRTPath = path.join(this.outputDir, `subtitles_${Date.now()}.srt`);
      const hasSubtitles = finalSubtitles.length > 0;
      if (hasSubtitles) {
        this.createSRTFile(finalSubtitles, tempSRTPath);
        console.log(`[ReelService] Temporary subtitle file created at: ${tempSRTPath}`);
      }

      // 4) Build FFmpeg CLI arguments
      const args = [];
      
      // Add input images, looping each for displayDuration
      images.forEach((img) => {
        args.push('-loop', '1', '-t', displayDuration.toString(), '-i', path.resolve(img));
      });

      // Add voiceover input
      args.push('-i', path.resolve(voicePath));

      // Add background music input if configured
      const hasMusic = !!bgMusicPath && fs.existsSync(bgMusicPath);
      if (hasMusic) {
        args.push('-stream_loop', '-1', '-i', path.resolve(bgMusicPath));
      }

      // 5) Build FFmpeg filter complex graph
      let filterComplex = '';
      
      // Step A: Format, scale, pad each slide to 1080x1920 and apply crossfade fades
      const fadeDuration = 0.4;
      images.forEach((_, idx) => {
        const inStart = 0;
        const outStart = displayDuration - fadeDuration;
        filterComplex += `[${idx}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,fade=t=in:st=${inStart}:d=${fadeDuration},fade=t=out:st=${outStart}:d=${fadeDuration}[v${idx}]; `;
      });

      // Step B: Concat all processed image streams
      const concatInputs = images.map((_, idx) => `[v${idx}]`).join('');
      filterComplex += `${concatInputs}concat=n=${numImages}:v=1:a=0[concat_video]; `;

      // Step C: Apply subtitles burn filter
      if (hasSubtitles) {
        const escapedSRT = this.escapeSubtitlesPath(tempSRTPath);
        // Centered text with margin from bottom and outlines
        filterComplex += `[concat_video]subtitles='${escapedSRT}':force_style='FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2.5,Alignment=2,MarginV=180'[final_video]; `;
      } else {
        filterComplex += `[concat_video]null[final_video]; `;
      }

      // Step D: Mix audio channels if background music is configured
      if (hasMusic) {
        // Voiceover is index (numImages)
        // Music is index (numImages + 1)
        filterComplex += `[${numImages}:a]volume=1.0[voice]; [${numImages + 1}:a]volume=0.12[bgm]; [voice][bgm]amix=inputs=2:duration=first:dropout_transition=2[final_audio]`;
      }

      args.push('-filter_complex', filterComplex);
      args.push('-map', '[final_video]');
      if (hasMusic) {
        args.push('-map', '[final_audio]');
      } else {
        args.push('-map', `${numImages}:a`);
      }

      // Output settings optimized for social media vertical layout (H.264 video, AAC audio)
      const filename = `reel_${Date.now()}.mp4`;
      const localFilePath = path.join(this.outputDir, filename);
      const relativeLocalPath = `generated/videos/${filename}`;

      args.push(
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '22',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-t', duration.toString(), // strictly cut at voice duration
        '-y',
        path.resolve(localFilePath)
      );

      // 6) Promise execution
      return new Promise((resolve, reject) => {
        console.log(`[ReelService] Running FFmpeg compilation...`);
        
        const child = spawn(ffmpegPath, args);
        let stderrData = '';

        child.stderr.on('data', (data) => {
          stderrData += data.toString();
        });

        child.on('error', (err) => {
          // Cleanup SRT
          if (hasSubtitles && fs.existsSync(tempSRTPath)) {
            try { fs.unlinkSync(tempSRTPath); } catch {}
          }
          console.error('[ReelService process spawn error]', err);
          return reject(new AppError(`Failed to start FFmpeg process: ${err.message}. Ensure FFMPEG_PATH is correct.`, 500));
        });

        child.on('close', (code) => {
          // Cleanup SRT
          if (hasSubtitles && fs.existsSync(tempSRTPath)) {
            try {
              fs.unlinkSync(tempSRTPath);
            } catch (cleanupErr) {
              console.warn(`[ReelService Cleanup Warning] Failed to delete temp SRT:`, cleanupErr.message);
            }
          }

          if (code === 0) {
            console.log(`[ReelService] Reel compiled successfully! Path: ${relativeLocalPath}`);
            resolve(relativeLocalPath);
          } else {
            console.error(`[ReelService FFmpeg Error] Code: ${code}. Log:\n`, stderrData);
            reject(new AppError(`FFmpeg compilation failed with exit code ${code}. Stderr: ${stderrData.trim()}`, 500));
          }
        });
      });

    } catch (error) {
      console.error('[ReelService Error]', error);
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to compile reel video: ${error.message}`, 500);
    }
  }

  /**
   * Compiles a Reel automatically by pulling all related media elements from MongoDB.
   * @param {string} [topicId] - Optional topic ID. If not provided, the latest completed AudioAsset is used.
   * @returns {Promise<object>} The saved VideoAsset document.
   */
  async compileReelFromDB(topicId) {
    let targetTopicId = topicId;
    let audioAsset = null;
    let caption = null;

    if (targetTopicId) {
      caption = await Caption.findOne({ topicId: targetTopicId });
      if (!caption) {
        throw new AppError(`No Caption found for topic ID: ${targetTopicId}`, 404);
      }
      const voiceScript = await VoiceScript.findOne({ captionId: caption._id });
      if (!voiceScript) {
        throw new AppError(`No VoiceScript found for Caption ID: ${caption._id}`, 404);
      }
      audioAsset = await AudioAsset.findOne({ scriptId: voiceScript._id });
      if (!audioAsset) {
        throw new AppError(`No AudioAsset found for VoiceScript ID: ${voiceScript._id}`, 404);
      }
    } else {
      audioAsset = await AudioAsset.findOne().sort({ createdAt: -1 }).populate({
        path: 'scriptId',
        populate: {
          path: 'captionId',
          populate: {
            path: 'topicId'
          }
        }
      });
      if (!audioAsset) {
        throw new AppError('No AudioAsset found in the database to compile Reel from.', 404);
      }
      const voiceScript = audioAsset.scriptId;
      if (!voiceScript) {
        throw new AppError('VoiceScript not populated on latest AudioAsset.', 500);
      }
      caption = voiceScript.captionId;
      if (!caption) {
        throw new AppError('Caption not populated on latest VoiceScript.', 500);
      }
      const topic = caption.topicId;
      if (!topic) {
        throw new AppError('Topic not populated on latest Caption.', 500);
      }
      targetTopicId = topic._id;
    }

    // Pipeline Log
    await logPipelineEvent(targetTopicId, 'Reel Generator', 'started', 'Starting compilation of reel from MongoDB assets.');

    // Fetch the ContentPlan
    const contentPlan = await ContentPlan.findOne({ topicId: targetTopicId });
    if (!contentPlan) {
      throw new AppError(`No ContentPlan found for topic ID: ${targetTopicId}`, 404);
    }

    // Fetch storyboard scenes in order
    const scenes = await SceneStoryboard.find({ contentPlanId: contentPlan._id }).sort({ slideNumber: 1 });
    if (scenes.length === 0) {
      throw new AppError(`No SceneStoryboard slides found for ContentPlan ID: ${contentPlan._id}`, 404);
    }

    // Retrieve corresponding GeneratedImages linked directly to sceneId
    const generatedImages = await GeneratedImage.find({ sceneId: { $in: sceneIds } });
    const sceneToImageMap = {};
    for (const img of generatedImages) {
      if (img.sceneId) {
        sceneToImageMap[img.sceneId.toString()] = img;
      }
    }

    // Gather ordered local paths
    const localImagePaths = [];
    for (const scene of scenes) {
      const img = sceneToImageMap[scene._id.toString()];
      if (img && img.localPath) {
        localImagePaths.push(img.localPath);
      }
    }

    if (localImagePaths.length === 0) {
      throw new AppError('No generated local image assets found for the storyboard scenes.', 404);
    }

    // Use createReel method
    // Note: createReel takes script object { hook, body, cta } for default timing subtitles
    const relativeVideoPath = await this.createReel({
      images: localImagePaths,
      voicePath: audioAsset.audioPath,
      script: caption
    });

    const absoluteVideoPath = path.resolve(relativeVideoPath);
    let cloudinaryUrl = '';

    if (isCloudinaryConfigured) {
      try {
        console.log(`[ReelService] Uploading video to Cloudinary: ${absoluteVideoPath}...`);
        const result = await cloudinary.uploader.upload(absoluteVideoPath, {
          resource_type: 'video',
          folder: 'instagram_personal_automation/videos'
        });
        cloudinaryUrl = result.secure_url;
        console.log(`[ReelService] Cloudinary upload successful: ${cloudinaryUrl}`);
      } catch (err) {
        console.error(`[ReelService] Cloudinary video upload failed:`, err.message);
        // Fallback to local
      }
    } else {
      console.warn(`[ReelService Warning] Cloudinary not configured. Video URL will use local static fallback.`);
    }

    // Clear existing VideoAsset for this topic
    await VideoAsset.deleteMany({ topicId: targetTopicId });

    // Create VideoAsset
    const videoAsset = await VideoAsset.create({
      topicId: targetTopicId,
      videoPath: relativeVideoPath,
      cloudinaryUrl: cloudinaryUrl || null,
      duration: audioAsset.duration
    });

    await logPipelineEvent(targetTopicId, 'Reel Generator', 'completed', `Reel compiled successfully! Path: ${relativeVideoPath} (Duration: ${audioAsset.duration}s)`);

    return videoAsset;
  }
}

export default new ReelService();
