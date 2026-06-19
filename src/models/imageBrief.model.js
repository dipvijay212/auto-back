import mongoose from 'mongoose';

const imageBriefSchema = new mongoose.Schema(
  {
    sceneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SceneStoryboard',
      required: true
    },
    subject: {
      type: String,
      required: true
    },
    action: {
      type: String,
      required: true
    },
    location: {
      type: String,
      required: true
    },
    mood: {
      type: String,
      required: true
    },
    style: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

const ImageBrief = mongoose.model('ImageBrief', imageBriefSchema);

export default ImageBrief;
