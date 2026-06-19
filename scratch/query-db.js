import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/instagram_automation';

async function run() {
  console.log("Connecting to:", mongoUri);
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected successfully!");

    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name));

    // Define schemas dynamically for inspection
    const ContentPlan = mongoose.model('ContentPlan', new mongoose.Schema({}, { strict: false }), 'contentplans');
    const SceneStoryboard = mongoose.model('SceneStoryboard', new mongoose.Schema({}, { strict: false }), 'scenestoryboards');
    const GeneratedImage = mongoose.model('GeneratedImage', new mongoose.Schema({}, { strict: false }), 'generatedimages');
    const PipelineLog = mongoose.model('PipelineLog', new mongoose.Schema({}, { strict: false }), 'pipelinelogs');

    const plansCount = await ContentPlan.countDocuments();
    const scenesCount = await SceneStoryboard.countDocuments();
    const imagesCount = await GeneratedImage.countDocuments();
    const logsCount = await PipelineLog.countDocuments();

    console.log(`Counts -> ContentPlans: ${plansCount}, SceneStoryboards: ${scenesCount}, GeneratedImages: ${imagesCount}, PipelineLogs: ${logsCount}`);

    const latestPlan = await ContentPlan.findOne().sort({ createdAt: -1 });
    console.log("\n----- LATEST CONTENT PLAN -----");
    console.log(JSON.stringify(latestPlan, null, 2));

    if (latestPlan) {
      const planScenes = await SceneStoryboard.find({ contentPlanId: latestPlan._id }).sort({ slideNumber: 1 });
      console.log(`\n----- SCENES FOR LATEST CONTENT PLAN (${latestPlan._id}) (Count: ${planScenes.length}) -----`);
      planScenes.forEach(s => {
        console.log(`Slide #${s.slideNumber}: Title: "${s.title}"`);
        console.log(`  imagePrompt: "${s.imagePrompt}"`);
      });
    }

    console.log("\n----- LATEST 15 PIPELINE LOGS -----");
    const logs = await PipelineLog.find().sort({ timestamp: -1 }).limit(15);
    logs.forEach(log => {
      console.log(`[${log.timestamp?.toISOString() || log.createdAt?.toISOString()}] [${log.stepName}] [${log.status}] ${log.message}`);
    });

  } catch (err) {
    console.error("Error running script:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

run();
