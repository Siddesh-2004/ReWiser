const express = require('express');
const { z } = require('zod');
const Session = require('../models/Session');
const Topic = require('../models/Topic');
const auth = require('../middleware/auth');
const { HttpError } = require('../errors');
const { limits } = require('../config');
const { generateFirstQuestion, evaluateAndNext } = require('../services/interview');
const { summarize } = require('../services/scoring');

const router = express.Router();
router.use(auth);

const startSchema = z.object({
  topicId: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  questionCount: z.number().int().min(1).max(10).default(5),
});

const answerSchema = z.object({
  transcript: z.string().trim().min(1).max(limits.transcriptChars),
});

async function findOwnedSession(req) {
  const session = await Session.findOne({ _id: req.params.id, userId: req.userId });
  if (!session) throw new HttpError(404, 'SESSION_NOT_FOUND', 'Session not found');
  return session;
}

// Start a session: generates the first question.
router.post('/', async (req, res) => {
  const { topicId, difficulty, questionCount } = startSchema.parse(req.body);

  const topic = await Topic.findOne({ _id: topicId, userId: req.userId });
  if (!topic) throw new HttpError(404, 'TOPIC_NOT_FOUND', 'Topic not found');

  const { question, model, promptVersion } = await generateFirstQuestion(topic, difficulty);

  const session = await Session.create({
    userId: req.userId,
    topicId: topic._id,
    topicTitle: topic.title,
    difficulty,
    questionCount,
    turns: [{ index: 0, question, model, promptVersion }],
  });

  res.status(201).json({
    sessionId: session.id,
    index: 0,
    remaining: questionCount - 1,
    question,
  });
});

// Submit the transcript of an answer: evaluates it and returns the next question.
// Feedback is stored but not returned until the session is finished.
router.post('/:id/answer', async (req, res) => {
  const { transcript } = answerSchema.parse(req.body);

  const session = await findOwnedSession(req);
  if (session.status !== 'in_progress') {
    throw new HttpError(409, 'SESSION_NOT_ACTIVE', 'This session is already finished');
  }

  const index = session.turns.length - 1;
  if (session.turns[index].answered) {
    throw new HttpError(409, 'ALREADY_ANSWERED', 'This question was already answered');
  }

  const topic = await Topic.findOne({ _id: session.topicId, userId: req.userId });
  if (!topic) throw new HttpError(404, 'TOPIC_NOT_FOUND', 'The topic for this session was deleted');

  const turns = session.turns.map((t) => t.toObject());
  const { evaluation, next, model, promptVersion } = await evaluateAndNext({
    topic,
    difficulty: session.difficulty,
    turns,
    index,
    questionCount: session.questionCount,
    transcript,
  });

  const set = {
    [`turns.${index}.answered`]: true,
    [`turns.${index}.transcript`]: transcript,
    [`turns.${index}.evaluation`]: evaluation,
    [`turns.${index}.model`]: model,
    [`turns.${index}.promptVersion`]: promptVersion,
  };
  const update = { $set: set };

  let summary = null;
  if (next) {
    // Not $push: Mongo rejects $set on turns.N.* together with $push on turns (path conflict).
    // Setting the next index appends, because index + 1 equals the current array length.
    set[`turns.${index + 1}`] = { index: index + 1, question: next, answered: false, model, promptVersion };
  } else {
    turns[index] = { ...turns[index], answered: true, evaluation };
    summary = summarize(turns);
    set.status = 'completed';
    set.completedAt = new Date();
    set.summary = summary;
  }

  // The answered:false condition makes a double submit fail instead of overwriting.
  const updated = await Session.findOneAndUpdate(
    { _id: session._id, status: 'in_progress', [`turns.${index}.answered`]: false },
    update,
    { new: true }
  );
  if (!updated) throw new HttpError(409, 'ALREADY_ANSWERED', 'This question was already answered');

  if (next) {
    return res.json({
      completed: false,
      index: index + 1,
      remaining: session.questionCount - (index + 2),
      question: next,
    });
  }
  res.json({ completed: true, sessionId: session.id, summary });
});

// End a session early.
router.post('/:id/end', async (req, res) => {
  const session = await findOwnedSession(req);
  if (session.status !== 'in_progress') {
    throw new HttpError(409, 'SESSION_NOT_ACTIVE', 'This session is already finished');
  }
  session.status = 'abandoned';
  session.completedAt = new Date();
  session.summary = summarize(session.turns.map((t) => t.toObject())) || undefined;
  await session.save();
  res.json({ status: session.status, summary: session.summary || null });
});

router.get('/', async (req, res) => {
  const filter = { userId: req.userId };
  if (req.query.topicId) filter.topicId = String(req.query.topicId);
  const sessions = await Session.find(filter).select('-turns').sort({ createdAt: -1 });
  res.json({ sessions });
});

// In progress: only the current question. Finished: the full review.
router.get('/:id', async (req, res) => {
  const session = await findOwnedSession(req);
  const data = session.toObject();

  if (session.status === 'in_progress') {
    const last = data.turns[data.turns.length - 1];
    return res.json({
      session: {
        id: session.id,
        topicId: data.topicId,
        topicTitle: data.topicTitle,
        difficulty: data.difficulty,
        questionCount: data.questionCount,
        status: data.status,
        answeredCount: data.turns.filter((t) => t.answered).length,
        current: last.answered ? null : { index: last.index, question: last.question },
      },
    });
  }
  res.json({ session: data });
});

module.exports = router;