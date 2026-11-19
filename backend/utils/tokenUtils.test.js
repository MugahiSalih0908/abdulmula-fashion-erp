const test = require('node:test');
const assert = require('node:assert/strict');
const { hashRefreshToken, buildRefreshTokenRotationPipeline } = require('./tokenUtils');

test('refresh token storage uses a fixed-length one-way SHA-256 digest', () => {
  const token = 'example.refresh.token.value';
  const digest = hashRefreshToken(token);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(digest, hashRefreshToken(token));
  assert.notEqual(digest, token);
});

test('different refresh tokens produce different stored digests', () => {
  assert.notEqual(hashRefreshToken('refresh-a'), hashRefreshToken('refresh-b'));
});


test('refresh rotation pipeline consumes only supplied token values and appends a digest atomically', () => {
  const oldDigest = hashRefreshToken('old-refresh-token');
  const nextDigest = hashRefreshToken('new-refresh-token');
  const pipeline = buildRefreshTokenRotationPipeline(
    [oldDigest, 'legacy-raw-refresh-token'],
    nextDigest
  );

  assert.equal(pipeline.length, 1);
  const update = pipeline[0].$set.refreshTokens;
  assert.deepEqual(update.$concatArrays[0].$setDifference, [
    { $ifNull: ['$refreshTokens', []] },
    [oldDigest, 'legacy-raw-refresh-token']
  ]);
  assert.deepEqual(update.$concatArrays[1], [nextDigest]);
});

test('refresh rotation pipeline rejects unsafe token values', () => {
  assert.throws(() => buildRefreshTokenRotationPipeline([], hashRefreshToken('next')), TypeError);
  assert.throws(() => buildRefreshTokenRotationPipeline([''], hashRefreshToken('next')), TypeError);
  assert.throws(() => buildRefreshTokenRotationPipeline(['old'], 'raw-next-token'), TypeError);
});

test('refresh token hashing rejects non-string values', () => {
  for (const value of ['', null, undefined, 123, {}]) {
    assert.throws(() => hashRefreshToken(value), TypeError);
  }
});
