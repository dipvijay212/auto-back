import mongoose from 'mongoose';

const pipelineLogSchema = new mongoose.Schema(
  {
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      required: true
    },
    step: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['started', 'completed', 'failed'],
      required: true
    },
    message: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

const PipelineLog = mongoose.model('PipelineLog', pipelineLogSchema);

export default PipelineLog;
