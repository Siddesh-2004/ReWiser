const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, trim: true, default: 'General' },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Topic', topicSchema);
