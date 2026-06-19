import mongoose from 'mongoose';

const generatedImageSchema = new mongoose.Schema(
  {
    sceneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SceneStoryboard',
      required: true
    },
    imageUrl: {
      type: String,
      required: true
    },
    localPath: {
      type: String
    },
    cloudinaryId: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

const GeneratedImage = mongoose.model('GeneratedImage', generatedImageSchema);

export default GeneratedImage;
