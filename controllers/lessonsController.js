const DebugLesson = require('../models/DebugLesson');
const ErrorOccurrence = require('../models/ErrorOccurrence');
const { distillDebugSession } = require('../utils/geminiClient');

// POST /api/lessons/submit
const submitLesson = async (req, res) => {
  const { stackTrace, description, language } = req.body;
  const { companyId } = req.company;

  if (!stackTrace || !description) {
    return res.status(400).json({ error: 'stackTrace and description are required' });
  }

  let distilled;
  try {
    distilled = await distillDebugSession({ stackTrace, description });
  } catch (err) {
    return res.status(500).json({ error: `Gemini distillation failed: ${err.message}` });
  }

  let lesson;
  try {
    lesson = await DebugLesson.create({ ...distilled, companyId });
  } catch (err) {
    return res.status(500).json({ error: `Failed to save lesson: ${err.message}` });
  }

  // Create a corresponding resolved ErrorOccurrence so Analytics shows real data
  try {
    await ErrorOccurrence.create({
      rawMessage: stackTrace,
      errorType:  distilled.errorType || undefined,
      source:     'manual',
      language:   language || 'unknown',
      filePath:   null,
      companyId,
      resolved:   true,
      lessonId:   lesson._id,
    });
  } catch (err) {
    console.error('[DEBUG] ErrorOccurrence creation failed (submitLesson):', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  }

  return res.status(201).json(lesson);
};

// POST /api/lessons/match
const matchLesson = async (req, res) => {
  const { stackTrace, description } = req.body;
  const { companyId } = req.company;

  if (!stackTrace || !description) {
    return res.status(400).json({ error: 'stackTrace and description are required' });
  }

  let signals;
  try {
    signals = await distillDebugSession({ stackTrace, description });
  } catch (err) {
    return res.status(500).json({ error: `Gemini distillation failed: ${err.message}` });
  }

  const { errorType, tags: newTags } = signals;
  const stackLower = stackTrace.toLowerCase();

  let allLessons;
  try {
    allLessons = await DebugLesson.find({ companyId });
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch lessons: ${err.message}` });
  }

  // Score each lesson
  const scored = allLessons
    .map((lesson) => {
      let score = 0;

      // +3 for exact errorType match
      if (lesson.errorType && errorType && lesson.errorType === errorType) {
        score += 3;
      }

      // +1 per overlapping tag
      if (Array.isArray(lesson.tags) && Array.isArray(newTags)) {
        for (const tag of newTags) {
          if (lesson.tags.includes(tag)) score += 1;
        }
      }

      // +2 if any word from failureSignature appears in the stackTrace
      if (lesson.failureSignature) {
        const words = lesson.failureSignature.toLowerCase().split(/\s+/);
        for (const word of words) {
          if (word && stackLower.includes(word)) {
            score += 2;
            break; // only award once per lesson
          }
        }
      }

      return { lesson, score };
    })
    .filter(({ score }) => score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length === 0) {
    // Log this as an unresolved occurrence — error was searched but no fix found yet
    try {
      await ErrorOccurrence.create({
        rawMessage: stackTrace,
        errorType:  signals.errorType || undefined,
        source:     'manual',
        language:   'unknown',
        filePath:   null,
        companyId,
        resolved:   false,
      });
    } catch (err) {
      console.error('[DEBUG] ErrorOccurrence creation failed (matchLesson):', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    }

    return res.status(200).json({ matches: [], message: 'No similar past lessons found.' });
  }

  // Increment timesMatched for each returned lesson
  try {
    await Promise.all(
      scored.map(({ lesson }) =>
        DebugLesson.findByIdAndUpdate(lesson._id, { $inc: { timesMatched: 1 } })
      )
    );
  } catch (err) {
    // Non-fatal — matches are still returned even if the counter update fails
    console.error('Failed to increment timesMatched:', err.message);
  }

  return res.status(200).json({
    matches: scored.map(({ lesson, score }) => ({ lesson, score })),
  });
};

// GET /api/lessons
const listLessons = async (req, res) => {
  const { companyId } = req.company;

  try {
    const lessons = await DebugLesson.find({ companyId }).sort({ createdAt: -1 });
    return res.status(200).json({ lessons });
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch lessons: ${err.message}` });
  }
};

module.exports = { submitLesson, matchLesson, listLessons };
