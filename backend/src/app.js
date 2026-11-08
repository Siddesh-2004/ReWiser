const express = require('express');
const cors = require('cors');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/topics', require('./routes/topics'));
app.use('/api/sessions', require('./routes/sessions'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
