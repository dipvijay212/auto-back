import mongoose from 'mongoose';

const publishedPostSchema = new mongoose.Schema(
  {
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
      required: true
    },
    instagramPostId: {
      type: String,
      required: true
    },
    mediaType: {
      type: String,
      default: 'REEL'
    },
    publishedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

const PublishedPost = mongoose.model('PublishedPost', publishedPostSchema);

export default PublishedPost;
