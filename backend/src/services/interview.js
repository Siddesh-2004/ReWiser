const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { chatJson } = require('./llm');
const { overallScore } = require('./scoring');
const { llm } = require('../config');
const { HttpError } = require('../errors');

const PROMPT_VERSION = 'v1';

const DIFFICULTY_GUIDE = {
  easy: 'Easy. Definitions and simple one-step applications.',
  medium: 'Medium. Ask why and how, with a small realistic situation.',
  hard: 'Hard. Trade-offs, edge cases and debugging situations.',
};

const TYPE_ROTATION = ['conceptual', 'practical', 'scenario', 'problem_solving'];
const QUESTION_TYPES = [...TYPE_ROTATION, 'follow_up'];

// ---------- prompts ----------

const promptCache = {};
function loadPrompt(name) {
  if (!promptCache[name]) {
    promptCache[name] = fs.readFileSync(path.join(__dirname, '..', 'prompts', `${name}.${PROMPT_VERSION}.md`), 'utf8');
  }
  return promptCache[name];
}

function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in vars)) throw new Error(`Missing prompt variable ${key}`);
    return vars[key];
  });
}

// ---------- schemas ----------

const questionJsonSchema = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    type: { type: 'string', enum: QUESTION_TYPES },
  },
  required: ['text', 'type'],
};

function evaluationJsonSchema(includeNext) {
  const properties = {
    correctness: { type: 'integer' },
    completeness: { type: 'integer' },
    fluency: { type: 'integer' },
    feedback: { type: 'string' },
    missing_concepts: { type: 'array', items: { type: 'string' } },
    incorrect_statements: { type: 'array', items: { type: 'string' } },
    ideal_answer: { type: 'string' },
    low_confidence_transcript: { type: 'boolean' },
  };
  const required = Object.keys(properties);
  if (includeNext) {
    properties.next_question = questionJsonSchema;
    required.push('next_question');
  }
  return { type: 'object', properties, required };
}

const questionZod = z.object({
  text: z.string().trim().min(5).max(600),
  type: z.enum(QUESTION_TYPES),
});

const scoreZod = z.number().min(0).max(10).transform((n) => Math.round(n));

const evaluationZod = z.object({
  correctness: scoreZod,
  completeness: scoreZod,
  fluency: scoreZod,
  feedback: z.string().trim().min(1),
  missing_concepts: z.array(z.string().trim().toLowerCase()).max(10),
  incorrect_statements: z.array(z.string()).max(10),
  ideal_answer: z.string().trim().min(1),
  low_confidence_transcript: z.boolean(),
});
const evaluationWithNextZod = evaluationZod.extend({ next_question: questionZod });

// ---------- LLM call with one retry ----------

function parseJson(raw) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned);
}

function describeError(err) {
  if (err instanceof z.ZodError) {
    return err.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ');
  }
  return err.message;
}

async function callValidated({ system, user, schema, validator }) {
  let userMessage = user;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await chatJson({ system, user: userMessage, schema });
    try {
      return validator.parse(parseJson(raw));
    } catch (err) {
      userMessage = `${user}\n\nYour previous reply was invalid (${describeError(err)}). Reply again with valid JSON only.`;
    }
  }
  throw new HttpError(502, 'LLM_INVALID_OUTPUT', 'The model returned an invalid response. Please try again.');
}

// ---------- message builders ----------

// Notes and transcripts are untrusted: strip our own delimiter tags so they cannot break out.
const strip = (text, tag) => String(text).split(`</${tag}>`).join('');

function topicBlock(topic) {
  let block = `Topic: ${topic.title}`;
  if (topic.description) block += `\nDescription: ${topic.description}`;
  if (topic.notes) block += `\n\n<reference_notes>\n${strip(topic.notes, 'reference_notes')}\n</reference_notes>`;
  return block;
}

// ---------- public API ----------

async function generateFirstQuestion(topic, difficulty) {
  const system = fill(loadPrompt('question'), {
    difficulty_guide: DIFFICULTY_GUIDE[difficulty],
    question_type: TYPE_ROTATION[0],
  });
  const user = `${topicBlock(topic)}\n\nQuestions already asked: none`;
  const question = await callValidated({
    system,
    user,
    schema: questionJsonSchema,
    validator: questionZod,
  });
  return { question, model: llm.model, promptVersion: PROMPT_VERSION };
}

// turns: plain objects, the last one (at `index`) is the question being answered.
async function evaluateAndNext({ topic, difficulty, turns, index, questionCount, transcript }) {
  const current = turns[index];
  const includeNext = questionCount - (index + 1) > 0;

  const nextInstruction = includeNext
    ? `Write the next interview question. Difficulty: ${DIFFICULTY_GUIDE[difficulty]} ` +
      `Use type follow_up if this answer showed a gap worth probing, otherwise use type ` +
      `${TYPE_ROTATION[(index + 1) % TYPE_ROTATION.length]}. Spoken style, no markdown, no code blocks, ` +
      `and do not repeat any earlier question.`
    : 'This was the last question. Do not include next_question.';

  const system = fill(loadPrompt('evaluate'), { next_instruction: nextInstruction });

  const recent = turns
    .slice(Math.max(0, index - 3), index)
    .filter((t) => t.answered)
    .map((t) => `Q: ${t.question.text}\nA: ${t.transcript}`)
    .join('\n\n');
  const asked = turns.map((t) => `- ${t.question.text}`).join('\n');

  const user = [
    topicBlock(topic),
    `Recent exchange:\n${recent || 'none'}`,
    `Questions already asked (do not repeat):\n${asked}`,
    `Current question: ${current.question.text}`,
    `<answer>\n${strip(transcript, 'answer')}\n</answer>`,
  ].join('\n\n');

  const result = await callValidated({
    system,
    user,
    schema: evaluationJsonSchema(includeNext),
    validator: includeNext ? evaluationWithNextZod : evaluationZod,
  });

  const evaluation = {
    correctness: result.correctness,
    completeness: result.completeness,
    fluency: result.fluency,
    feedback: result.feedback,
    missingConcepts: result.missing_concepts,
    incorrectStatements: result.incorrect_statements,
    idealAnswer: result.ideal_answer,
    lowConfidenceTranscript: result.low_confidence_transcript,
  };
  evaluation.overall = overallScore(evaluation);

  return {
    evaluation,
    next: includeNext ? result.next_question : null,
    model: llm.model,
    promptVersion: PROMPT_VERSION,
  };
}

module.exports = { generateFirstQuestion, evaluateAndNext };
