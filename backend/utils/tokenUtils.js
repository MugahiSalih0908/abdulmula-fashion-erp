// utils/tokenUtils.js

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateAccessToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRE || '15m'
  });

const generateRefreshToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d'
  });

const verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });

// Store only this one-way digest in MongoDB. The raw token is returned once to the client.
const hashRefreshToken = (token) => {
  if (typeof token !== 'string' || !token) {
    throw new TypeError('A refresh token is required.');
  }
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
};

// Build an atomic MongoDB update pipeline. It removes the consumed raw/digested
// token(s) from the current document and appends the next digest in one write.
// MongoDB serializes document updates, preventing refresh-token replay races
// and lost updates when different devices refresh concurrently.
const buildRefreshTokenRotationPipeline = (consumedTokens, nextTokenDigest) => {
  if (!Array.isArray(consumedTokens) || !consumedTokens.length ||
      consumedTokens.some(token => typeof token !== 'string' || !token)) {
    throw new TypeError('At least one consumed refresh token is required.');
  }
  if (typeof nextTokenDigest !== 'string' || !/^[a-f0-9]{64}$/.test(nextTokenDigest)) {
    throw new TypeError('The next refresh token must be a SHA-256 digest.');
  }

  return [{
    $set: {
      refreshTokens: {
        $concatArrays: [
          {
            $setDifference: [
              { $ifNull: ['$refreshTokens', []] },
              consumedTokens
            ]
          },
          [nextTokenDigest]
        ]
      }
    }
  }];
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
  buildRefreshTokenRotationPipeline
};
