import mongoose from 'mongoose';

const automationConfigSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: true
    },
    schedule: {
      type: [String],
      default: ["9 AM", "2 PM", "7 PM"]
    }
  },
  {
    timestamps: true
  }
);

const AutomationConfig = mongoose.model('AutomationConfig', automationConfigSchema);

export default AutomationConfig;
