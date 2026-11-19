const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const supplierRoutes = readFileSync(path.join(__dirname, 'suppliers.js'), 'utf8');

test('supplier edits only accept contact and descriptive fields', () => {
  assert.match(supplierRoutes, /for \(const field of \['name', 'phone', 'email', 'address', 'company', 'notes'\]\)/);
  assert.match(supplierRoutes, /\{ \$set: updates \}/);
  assert.doesNotMatch(supplierRoutes, /findOneAndUpdate\([\s\S]{0,160}req\.body/);
});
