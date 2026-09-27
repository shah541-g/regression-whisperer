const mongoose = require('mongoose');

const errorOccurrenceSchema = new mongoose.Schema({
  rawMessage: {
    type: String,
    required: true,
  },
  errorType: {
    type: String,
  },
  source: {
    type: String,
    enum: ['diagnostics', 'terminal', 'manual'],
    default: 'diagnostics',
  },
  language: {
    type: String,
  },
  filePath: {
    type: String,
  },
  tags: {
    type: [String],
    default: [],
  },
  resolved: {
    type: Boolean,
    default: false,
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DebugLesson',
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

module.exports = mongoose.model('ErrorOccurrence', errorOccurrenceSchema);
