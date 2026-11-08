const express = require('express');
const { z } = require('zod');
const Topic = require('../models/Topic');
const auth = require('../middleware/auth');
const { HttpError } = require('../errors');
const { limits } = require('../config');

const router = express.Router();
router.use(auth);

const topicSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  notes: z.string().max(limits.notesChars).optional(),
});

async function findOwned(req) {
  const topic = await Topic.findOne({ _id: req.params.id, userId: req.userId });
  if (!topic) throw new HttpError(404, 'TOPIC_NOT_FOUND', 'Topic not found');
  return topic;
}

router.get('/', async (req, res) => {
  const filter = { userId: req.userId };
  if (req.query.category) filter.category = String(req.query.category);
  const topics = await Topic.find(filter).select('-notes').sort({ updatedAt: -1 });
  res.json({ topics });
});

router.post('/', async (req, res) => {
  const data = topicSchema.parse(req.body);
  const topic = await Topic.create({ ...data, userId: req.userId });
  res.status(201).json({ topic });
});

router.get('/:id', async (req, res) => {
  res.json({ topic: await findOwned(req) });
});

router.patch('/:id', async (req, res) => {
  const data = topicSchema.partial().parse(req.body);
  const topic = await findOwned(req);
  Object.assign(topic, data);
  await topic.save();
  res.json({ topic });
});

router.delete('/:id', async (req, res) => {
  const topic = await findOwned(req);
  await topic.deleteOne();
  res.status(204).end();
});

module.exports = router;
