const { ZodError } = require('zod');
const { HttpError } = require('../errors');

function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid id' } });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Already exists' } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}

module.exports = { notFound, errorHandler };
