import mongoose from 'mongoose';

const contentPlanSchema = new mongoose.Schema(
  {
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      required: true
    },
    industry: {
      type: String,
      required: true
    },
    audience: {
      type: String,
      required: true
    },
    goal: {
      type: String,
      required: true
    },
    painPoints: {
      type: [String],
      default: []
    },
    benefits: {
      type: [String],
      default: []
    },
    format: {
      type: String,
      required: true
    },
    visualScript: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

const ContentPlan = mongoose.model('ContentPlan', contentPlanSchema);

export default ContentPlan;
