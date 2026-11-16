const test = require('node:test');
const assert = require('node:assert/strict');
const { getPaginationOptions, escapeRegExp } = require('./queryPagination');

test('pagination stays opt-in so legacy list consumers remain compatible', () => {
  assert.equal(getPaginationOptions({}), null);
});

test('pagination validates page and clamps large limits', () => {
  assert.deepEqual(getPaginationOptions({ page: '3', limit: '25' }), {
    page: 3,
    limit: 25,
    skip: 50
  });
  assert.deepEqual(getPaginationOptions({ page: '-2', limit: '1000' }), {
    page: 1,
    limit: 100,
    skip: 0
  });
  assert.deepEqual(getPaginationOptions({ page: 'x', limit: '0' }), {
    page: 1,
    limit: 25,
    skip: 0
  });
});

test('regular expression search escapes user-provided metacharacters', () => {
  assert.equal(escapeRegExp('A+B (shirt)'), 'A\\+B \\(shirt\\)');
});
