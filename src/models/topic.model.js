import mongoose from 'mongoose';

const topicSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Topic title is required.'],
      trim: true
    },
    text: {
      type: String,
      trim: true
    },
    niche: {
      type: String,
      default: 'General'
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium'
    },
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Completed', 'Failed', 'Published'],
      default: 'Pending'
    },
    source: {
      type: String,
      default: 'Manual'
    },
    error: {
      type: String,
      default: ''
    },
    publishedMediaId: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Map title to text and text to title bidirectionally for backwards compatibility
topicSchema.pre('save', function (next) {
  if (this.title && !this.text) {
    this.text = this.title;
  } else if (this.text && !this.title) {
    this.title = this.text;
  }
  next();
});

topicSchema.index({ status: 1, createdAt: 1 });

const Topic = mongoose.model('Topic', topicSchema);

export default Topic;
