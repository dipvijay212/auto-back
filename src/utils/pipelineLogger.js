import PipelineLog from '../models/pipelineLog.model.js';
import AutomationLog from '../models/automationLog.model.js';

/**
 * Logs a pipeline execution milestone to MongoDB and the console.
 * @param {string|ObjectId} topicId - The ID of the topic being processed.
 * @param {string} step - The name of the pipeline step (e.g. 'Content Planner', 'Reel Generator').
 * @param {string} status - The status of the step: 'started', 'completed', or 'failed'.
 * @param {string} message - Descriptive log message.
 */
export const logPipelineEvent = async (topicId, step, status, message) => {
  const timestampStr = new Date().toISOString();
  const level = status === 'failed' ? 'ERROR' : 'INFO';
  console.log(`[${timestampStr}] [${level}] [${step}] ${message}`);

  try {
    // Write to pipeline-specific log collection
    if (topicId) {
      await PipelineLog.create({
        topicId,
        step,
        status,
        message
      });
    }

    // Also write to general automation logs for dashboard visibility
    await AutomationLog.create({
      level,
      message: `[${step}] [${status.toUpperCase()}] ${message}`
    });
  } catch (err) {
    console.error('[Pipeline Logger Error] Failed to write log:', err.message);
  }
};
