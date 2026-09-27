const mongoose = require('mongoose');

const debugLessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  failureSignature: {
    type: String,
    required: true,
  },
  errorType: {
    type: String,
  },
  stackTraceSnippet: {
    type: String,
  },
  rootCause: {
    type: String,
  },
  fixSteps: {
    type: [String],
  },
  tags: {
    type: [String],
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  timesMatched: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('DebugLesson', debugLessonSchema);
