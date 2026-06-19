import mongoose from 'mongoose';

const voiceScriptSchema = new mongoose.Schema(
  {
    captionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caption',
      required: true
    },
    scriptText: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

const VoiceScript = mongoose.model('VoiceScript', voiceScriptSchema);

export default VoiceScript;
