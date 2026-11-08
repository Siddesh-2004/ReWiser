const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema(
  {
    correctness: Number,
    completeness: Number,
    fluency: Number, // clarity of thought
    overall: Number, // computed by Node, not by the LLM
    feedback: String,
    missingConcepts: [String],
    incorrectStatements: [String],
    idealAnswer: String,
    lowConfidenceTranscript: Boolean,
  },
  { _id: false }
);

const turnSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true },
    question: {
      text: { type: String, required: true },
      type: { type: String, required: true },
    },
    answered: { type: Boolean, default: false },
    transcript: String,
    evaluation: evaluationSchema,
    model: String,
    promptVersion: String,
  },
  { _id: false }
);

const summarySchema = new mongoose.Schema(
  {
    correctness: Number,
    completeness: Number,
    fluency: Number,
    overall: Number,
    answeredCount: Number,
    missingConcepts: [String],
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true, index: true },
    topicTitle: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    questionCount: { type: Number, required: true },
    status: { type: String, enum: ['in_progress', 'completed', 'abandoned'], default: 'in_progress' },
    completedAt: Date,
    turns: [turnSchema],
    summary: summarySchema,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);
