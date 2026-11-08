const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('../models/User');
const { jwtSecret, jwtExpiresIn } = require('../config');
const { HttpError } = require('../errors');

const router = express.Router();

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(100),
  name: z.string().trim().max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const signToken = (user) => jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: jwtExpiresIn });

router.post('/register', async (req, res) => {
  const { email, password, name } = registerSchema.parse(req.body);

  if (await User.exists({ email: email.toLowerCase() })) {
    throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash, name });
  res.status(201).json({ token: signToken(user), user: { id: user.id, email: user.email, name: user.name } });
});

router.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await User.findOne({ email: email.toLowerCase() });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');

  res.json({ token: signToken(user), user: { id: user.id, email: user.email, name: user.name } });
});

module.exports = router;
