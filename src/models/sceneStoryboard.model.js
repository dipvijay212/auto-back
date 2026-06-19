import mongoose from 'mongoose';

const sceneStoryboardSchema = new mongoose.Schema(
  {
    contentPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContentPlan',
      required: true
    },
    slideNumber: {
      type: Number,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    imagePrompt: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

const SceneStoryboard = mongoose.model('SceneStoryboard', sceneStoryboardSchema);

export default SceneStoryboard;
