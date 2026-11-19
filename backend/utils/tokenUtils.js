// utils/tokenUtils.js

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateAccessToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '15m' });

const generateRefreshToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' });

const verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET);

// Persist only a one-way digest of refresh tokens. The raw token is returned
// to the client once and is never stored in MongoDB.
const hashToken = (token) => {
  if (typeof token !== 'string' || token.length === 0) {
    throw new TypeError('A non-empty token string is required.');
  }
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
};

module.exports = { generateAccessToken, generateRefreshToken, verifyRefreshToken, hashToken };
