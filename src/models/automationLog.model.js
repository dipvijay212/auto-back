import mongoose from 'mongoose';

const automationLogSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now
    },
    level: {
      type: String,
      enum: ['INFO', 'SUCCESS', 'WARN', 'ERROR'],
      default: 'INFO'
    },
    message: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Index to keep querying fast and easily fetch recent logs
automationLogSchema.index({ timestamp: -1 });

const AutomationLog = mongoose.model('AutomationLog', automationLogSchema);

export default AutomationLog;
