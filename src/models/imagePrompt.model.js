import mongoose from 'mongoose';

const imagePromptSchema = new mongoose.Schema(
  {
    imageBriefId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ImageBrief',
      required: true
    },
    promptText: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

const ImagePrompt = mongoose.model('ImagePrompt', imagePromptSchema);

export default ImagePrompt;
