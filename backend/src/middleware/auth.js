const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');
const { HttpError } = require('../errors');

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Missing or malformed Authorization header');
  }
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.userId = payload.sub;
    next();
  } catch {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
}

module.exports = auth;
