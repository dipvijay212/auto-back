import mongoose from 'mongoose';

const captionSchema = new mongoose.Schema(
  {
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      required: true
    },
    hook: {
      type: String,
      required: true
    },
    body: {
      type: String,
      required: true
    },
    cta: {
      type: String,
      required: true
    },
    hashtags: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

const Caption = mongoose.model('Caption', captionSchema);

export default Caption;
