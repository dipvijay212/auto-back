import mongoose from 'mongoose';

const audioAssetSchema = new mongoose.Schema(
  {
    scriptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VoiceScript',
      required: true
    },
    audioPath: {
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

const AudioAsset = mongoose.model('AudioAsset', audioAssetSchema);

export default AudioAsset;
