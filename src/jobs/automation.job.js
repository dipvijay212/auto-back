import cron from 'node-cron';
import Topic from '../models/topic.model.js';
import AutomationConfig from '../models/automationConfig.model.js';
import AutomationLog from '../models/automationLog.model.js';
import contentPlannerService from '../services/contentPlanner.service.js';
import sceneGeneratorService from '../services/sceneGenerator.service.js';
import imageBriefService from '../services/imageBrief.service.js';
import imagePromptService from '../services/imagePrompt.service.js';
import imageGeneratorService from '../services/imageGenerator.service.js';
import captionService from '../services/caption.service.js';
import reelScriptService from '../services/reelScript.service.js';
import voiceService from '../services/voice.service.js';
import reelService from '../services/reel.service.js';
import instagramService from '../services/instagram.service.js';

/**
 * Writes a log message to both console and MongoDB log collection.
 */
export const writeLog = async (level, message) => {
  const timestampStr = new Date().toISOString();
  console.log(`[${timestampStr}] [${level}] ${message}`);
  try {
    await AutomationLog.create({ level, message });
  } catch (err) {
    console.error('[Automation Log Error] Failed to write log to DB:', err.message);
  }
};

/**
 * Executes the full end-to-end automation workflow for the next pending topic.
 */
export const runAutomationPipeline = async () => {
  await writeLog('INFO', 'Starting Instagram automation pipeline...');

  // 1) Find the next pending topic from MongoDB
  let topicDoc = null;
  try {
    topicDoc = await Topic.findOne({ status: { $in: ['pending', 'Pending'] } }).sort({ createdAt: 1 });
  } catch (dbErr) {
    await writeLog('ERROR', `Failed to query database for topics: ${dbErr.message}`);
    return;
  }

  if (!topicDoc) {
    await writeLog('INFO', 'No pending topics found in the queue. Pipeline execution skipped.');
    return;
  }

  const topicText = topicDoc.title || topicDoc.text;
  await writeLog('INFO', `Processing topic: "${topicText}" (ID: ${topicDoc._id})`);

  // Update status to processing to prevent double runs
  topicDoc.status = 'Processing';
  await topicDoc.save();

  try {
    // 2) Content Planner
    await writeLog('INFO', 'Step 1: Running Content Planner...');
    const plan = await contentPlannerService.planContent(topicText, topicDoc._id);
    await writeLog('INFO', `Content plan generated with ID: ${plan._id}`);

    // 3) Scene Storyboard
    await writeLog('INFO', 'Step 2: Running Scene Storyboard...');
    const scenes = await sceneGeneratorService.generateStoryboard(plan._id, topicText);
    await writeLog('INFO', `Generated ${scenes.length} storyboard slides.`);

    // 4) Image Brief Generator
    await writeLog('INFO', 'Step 3: Generating image briefs...');
    const briefs = await imageBriefService.generateBriefs(scenes);
    await writeLog('INFO', `Generated ${briefs.length} image briefs.`);

    // 5) Image Prompt Generator
    await writeLog('INFO', 'Step 4: Generating detailed image prompts...');
    const prompts = await imagePromptService.generatePromptsFromBriefs(briefs);
    await writeLog('INFO', `Generated ${prompts.length} image prompts.`);

    // 6) Image Generator (Pollinations + Cloudinary)
    await writeLog('INFO', 'Step 5: Generating and uploading visual assets...');
    await imageGeneratorService.generateImages(prompts);
    await writeLog('INFO', `Visual assets generated and saved to DB.`);

    // 7) Caption Generator
    await writeLog('INFO', 'Step 6: Generating caption bundle...');
    const captionDoc = await captionService.generateAndSaveCaption(topicText, plan, topicDoc._id);
    await writeLog('INFO', `Caption bundle saved with ID: ${captionDoc._id}`);

    // 8) Reel Script Service (Voice Script Generator)
    await writeLog('INFO', 'Step 7: Generating speech script...');
    const voiceScript = await reelScriptService.generateScriptFromCaption(captionDoc);
    await writeLog('INFO', `Voice script saved with ID: ${voiceScript._id}`);

    // 9) Voice Generator (Piper TTS)
    await writeLog('INFO', 'Step 8: Synthesizing voiceover audio...');
    const audioAsset = await voiceService.synthesizeVoice(voiceScript);
    await writeLog('INFO', `Voiceover audio asset saved with ID: ${audioAsset._id}`);

    // 10) Reel Generator (FFmpeg mix)
    await writeLog('INFO', 'Step 9: Compiling Reel video...');
    const videoAsset = await reelService.compileReelFromDB(topicDoc._id);
    await writeLog('INFO', `Video compiled successfully, saved with ID: ${videoAsset._id}`);

    // 11) Instagram Publisher
    await writeLog('INFO', 'Step 10: Publishing Reel to Instagram...');
    const publishedPost = await instagramService.publishFromDB(topicDoc._id);
    await writeLog('SUCCESS', `Reel published successfully! Media ID: ${publishedPost.instagramPostId}`);

    // 12) Update Database status to completed
    topicDoc.status = 'Completed';
    topicDoc.publishedMediaId = publishedPost.instagramPostId;
    topicDoc.error = '';
    await topicDoc.save();
    await writeLog('SUCCESS', 'Pipeline finished successfully.');

  } catch (error) {
    await writeLog('ERROR', `Pipeline failed for topic "${topicText}": ${error.message}`);
    
    // Update Database status to failed and store error details
    topicDoc.status = 'Failed';
    topicDoc.error = error.stack || error.message;
    await topicDoc.save();
  }
};

let activeCronTask = null;

/**
 * Reschedules node-cron tasks dynamically using configuration stored in MongoDB
 */
export const rescheduleJob = async () => {
  // Stop existing cron job if active
  if (activeCronTask) {
    activeCronTask.stop();
    activeCronTask = null;
  }

  // Load scheduler config from DB, or initialize defaults
  let config = await AutomationConfig.findOne();
  if (!config) {
    config = await AutomationConfig.create({
      enabled: true,
      schedule: ["9 AM", "2 PM", "7 PM"]
    });
  }

  if (!config.enabled) {
    await writeLog('INFO', 'Dynamic cron job scheduler is disabled.');
    return;
  }

  if (config.schedule.length === 0) {
    await writeLog('WARN', 'Dynamic scheduler is enabled but has no hours scheduled.');
    return;
  }

  // Map 12hr strings to 24hr numbers
  const hoursMap = {
    "9 AM": 9,
    "2 PM": 14,
    "7 PM": 19
  };

  const hours = config.schedule
    .map(time => hoursMap[time])
    .filter(h => h !== undefined);

  if (hours.length === 0) {
    await writeLog('WARN', 'Dynamic scheduler has no valid cron schedule times.');
    return;
  }

  // Build standard cron: e.g. '0 9,14,19 * * *'
  const cronExpression = `0 ${hours.join(',')} * * *`;
  
  await writeLog('INFO', `Rescheduling automation cron job: "${cronExpression}" (Times: ${config.schedule.join(', ')})`);

  activeCronTask = cron.schedule(cronExpression, async () => {
    await writeLog('INFO', 'Scheduled execution time triggered.');
    await runAutomationPipeline();
  });
};

/**
 * Initializes and schedules node-cron tasks.
 */
export const initAutomationJob = async () => {
  await rescheduleJob();
};
