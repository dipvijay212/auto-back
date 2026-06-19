import mongoose from 'mongoose';

const videoAssetSchema = new mongoose.Schema(
  {
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      required: true
    },
    videoPath: {
      type: String,
      required: true
    },
    cloudinaryUrl: {
      type: String,
      required: true
    },
    duration: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

const VideoAsset = mongoose.model('VideoAsset', videoAssetSchema);

export default VideoAsset;
