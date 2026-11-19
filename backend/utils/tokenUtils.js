// utils/tokenUtils.js

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateAccessToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '15m' });

const generateRefreshToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' });

const verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET);

// Store only a one-way digest of refresh tokens. A database-only disclosure
// should not immediately expose reusable bearer credentials.
const hashRefreshToken = (token) => {
  if (typeof token !== 'string' || !token) {
    throw new TypeError('A refresh token is required.');
  }
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashRefreshToken
};
