// utils/tokenUtils.js

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateAccessToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '15m' });

const generateRefreshToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' });

const verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET);

// Store only this one-way digest in MongoDB. The raw token is returned once to the client.
const hashRefreshToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashRefreshToken
};
