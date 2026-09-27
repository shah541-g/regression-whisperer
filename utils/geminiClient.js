const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

let _client = null;
let _model = null;

function getModel() {
  if (_model) return _model;

  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }

  _client = new GoogleGenerativeAI(apiKey);

  _model = _client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          failureSignature: { type: SchemaType.STRING },
          errorType: { type: SchemaType.STRING },
          rootCause: { type: SchemaType.STRING },
          fixSteps: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          tags: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
        },
        required: ['title', 'failureSignature', 'errorType', 'rootCause', 'fixSteps', 'tags'],
      },
    },
  });

  return _model;
}

function buildPrompt(rawInput) {
  return `You are a debugging assistant. Analyze the following stack trace and developer explanation, then extract a structured debug lesson.

Stack Trace:
${rawInput.stackTrace}

Developer Explanation:
${rawInput.description}

Return a JSON object with these exact fields:
- title: a short human-readable label for this bug
- failureSignature: normalized key error phrase(s) useful for future keyword matching
- errorType: the error class/type (e.g. NullPointerException, ECONNREFUSED, TypeError)
- rootCause: plain-English explanation of why this error happened
- fixSteps: ordered array of steps taken to fix the issue
- tags: array of lowercase keyword tags for categorization`;
}

function isTransient(err) {
  // Retry on network errors or HTTP 429 (rate limit)
  if (err.message && err.message.includes('429')) return true;
  if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') return true;
  return false;
}

async function distillDebugSession(rawInput) {
  const model = getModel();
  const prompt = buildPrompt(rawInput);

  let result;
  try {
    result = await model.generateContent(prompt);
  } catch (err) {
    if (!isTransient(err)) throw err;

    // Retry once on transient error
    try {
      result = await model.generateContent(prompt);
    } catch (retryErr) {
      throw retryErr;
    }
  }

  const text = result.response.text();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned malformed JSON: ${text}`);
  }

  return parsed;
}

module.exports = { distillDebugSession };
