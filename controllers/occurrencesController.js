const mongoose = require('mongoose');
const ErrorOccurrence = require('../models/ErrorOccurrence');

// Regex patterns for best-effort errorType extraction (no LLM, no I/O)
const ERROR_PATTERNS = [
  // Matches things like: TypeError, NullPointerException, ECONNREFUSED, ValueError
  /\b([A-Z][a-zA-Z]*(?:Error|Exception|Fault|Warning))\b/,
  // Matches all-caps POSIX-style codes: ENOENT, ECONNRESET, ETIMEDOUT
  /\b(E[A-Z]{3,})\b/,
  // Matches the first token before a colon if it looks like an error name
  // e.g. "SyntaxError: Unexpected token" or "error: cannot find module"
  /^([A-Za-z][A-Za-z0-9_]*(?:Error|Exception|error|exception))\s*:/m,
];

function extractErrorType(rawMessage) {
  for (const pattern of ERROR_PATTERNS) {
    const match = rawMessage.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ── POST /api/occurrences/log ──────────────────────────────────────────────
const logOccurrence = async (req, res) => {
  const { rawMessage, source, language, filePath } = req.body;
  const { companyId } = req.company;

  if (!rawMessage) {
    return res.status(400).json({ error: 'rawMessage is required' });
  }

  const errorType = extractErrorType(rawMessage) || undefined;

  try {
    const occurrence = await ErrorOccurrence.create({
      rawMessage,
      errorType,
      source,
      language,
      filePath,
      companyId,
    });
    return res.status(201).json(occurrence);
  } catch (err) {
    return res.status(500).json({ error: `Failed to save occurrence: ${err.message}` });
  }
};

// ── GET /api/occurrences ───────────────────────────────────────────────────
const listOccurrences = async (req, res) => {
  const { companyId } = req.company;
  const filter = { companyId };

  if (req.query.resolved !== undefined) {
    filter.resolved = req.query.resolved === 'true';
  }

  try {
    const occurrences = await ErrorOccurrence.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ occurrences });
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch occurrences: ${err.message}` });
  }
};

// ── GET /api/occurrences/stats ─────────────────────────────────────────────
const getStats = async (req, res) => {
  const { companyId } = req.company;
  console.log('[DEBUG] getStats called with companyId:', companyId, 'typeof:', typeof companyId);
  const directCount = await ErrorOccurrence.countDocuments({ companyId: new mongoose.Types.ObjectId(companyId) });
  console.log('[DEBUG] Direct countDocuments with this companyId:', directCount);
  const companyMatch = { $match: { companyId: new mongoose.Types.ObjectId(companyId) } };

  const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  try {
    // Run all aggregations in parallel
    const [
      totals,
      byErrorType,
      byLanguage,
      byDay,
      topUnresolved,
      resolutionTrend,
      avgResolutionRaw,
      bySource,
      top5ErrorTypes,
    ] = await Promise.all([

      // totalOccurrences, resolvedCount, unresolvedCount
      ErrorOccurrence.aggregate([
        companyMatch,
        {
          $group: {
            _id: null,
            totalOccurrences: { $sum: 1 },
            resolvedCount:    { $sum: { $cond: ['$resolved', 1, 0] } },
            unresolvedCount:  { $sum: { $cond: ['$resolved', 0, 1] } },
          },
        },
      ]),

      // top 10 errorTypes by count
      ErrorOccurrence.aggregate([
        companyMatch,
        { $match: { errorType: { $ne: null } } },
        { $group: { _id: '$errorType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, errorType: '$_id', count: 1 } },
      ]),

      // occurrences by language
      ErrorOccurrence.aggregate([
        companyMatch,
        { $match: { language: { $ne: null } } },
        { $group: { _id: '$language', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, language: '$_id', count: 1 } },
      ]),

      // occurrences per day for the last 14 days
      ErrorOccurrence.aggregate([
        companyMatch,
        { $match: { createdAt: { $gte: since14 } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', count: 1 } },
      ]),

      // top 5 unresolved errorType groups
      ErrorOccurrence.aggregate([
        companyMatch,
        { $match: { resolved: false, errorType: { $ne: null } } },
        { $group: { _id: '$errorType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, errorType: '$_id', count: 1 } },
      ]),

      // resolved vs unresolved per day — last 14 days
      ErrorOccurrence.aggregate([
        companyMatch,
        { $match: { createdAt: { $gte: since14 } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            resolved:   { $sum: { $cond: ['$resolved', 1, 0] } },
            unresolved: { $sum: { $cond: ['$resolved', 0, 1] } },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', resolved: 1, unresolved: 1 } },
      ]),

      // avg resolution time in hours (updatedAt − createdAt for resolved docs)
      ErrorOccurrence.aggregate([
        companyMatch,
        { $match: { resolved: true, updatedAt: { $exists: true } } },
        {
          $group: {
            _id: null,
            avgMs: {
              $avg: { $subtract: ['$updatedAt', '$createdAt'] },
            },
          },
        },
      ]),

      // occurrences by source
      ErrorOccurrence.aggregate([
        companyMatch,
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, source: '$_id', count: 1 } },
      ]),

      // top 5 errorTypes by total count (to pick which to track over time)
      ErrorOccurrence.aggregate([
        companyMatch,
        { $match: { errorType: { $ne: null }, createdAt: { $gte: since14 } } },
        { $group: { _id: '$errorType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, errorType: '$_id' } },
      ]),
    ]);

    // Build errorTypeOverTime: for each of the top 5 errorTypes, get daily counts
    const errorTypeOverTime = await Promise.all(
      top5ErrorTypes.map(async ({ errorType }) => {
        const dailyCounts = await ErrorOccurrence.aggregate([
          companyMatch,
          { $match: { errorType, createdAt: { $gte: since14 } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, date: '$_id', count: 1 } },
        ]);
        return { errorType, dailyCounts };
      })
    );

    const summary = totals[0] || { totalOccurrences: 0, resolvedCount: 0, unresolvedCount: 0 };
    const avgMs   = avgResolutionRaw[0]?.avgMs;
    const avgResolutionTimeHours = avgMs != null
      ? Math.round((avgMs / 3_600_000) * 10) / 10
      : null;

    return res.status(200).json({
      totalOccurrences: summary.totalOccurrences,
      resolvedCount:    summary.resolvedCount,
      unresolvedCount:  summary.unresolvedCount,
      byErrorType,
      byLanguage,
      byDay,
      topUnresolved,
      resolutionTrend,
      avgResolutionTimeHours,
      bySource,
      errorTypeOverTime,
    });
  } catch (err) {
    return res.status(500).json({ error: `Failed to compute stats: ${err.message}` });
  }
};

// ── PATCH /api/occurrences/:id/resolve ────────────────────────────────────
const resolveOccurrence = async (req, res) => {
  const { id } = req.params;
  const { lessonId } = req.body;
  const { companyId } = req.company;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid occurrence id' });
  }

  const update = { resolved: true };
  if (lessonId) {
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: 'Invalid lessonId' });
    }
    update.lessonId = lessonId;
  }

  try {
    // companyId filter prevents one company from resolving another's occurrence
    const occurrence = await ErrorOccurrence.findOneAndUpdate(
      { _id: id, companyId },
      update,
      { new: true }
    );
    if (!occurrence) {
      return res.status(404).json({ error: 'Occurrence not found' });
    }
    return res.status(200).json(occurrence);
  } catch (err) {
    return res.status(500).json({ error: `Failed to resolve occurrence: ${err.message}` });
  }
};

module.exports = { logOccurrence, listOccurrences, getStats, resolveOccurrence };
