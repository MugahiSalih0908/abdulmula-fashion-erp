const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const server = readFileSync(path.join(__dirname, 'server.js'), 'utf8');

test('MongoDB sanitizer runs after JSON and URL-encoded body parsers', () => {
  const jsonParser = server.indexOf("app.use(express.json");
  const formParser = server.indexOf("app.use(express.urlencoded");
  const sanitizer = server.indexOf("app.use(mongoSanitize())");
  const authRoutes = server.indexOf("app.use('/api/auth'");

  assert.ok(jsonParser >= 0);
  assert.ok(formParser > jsonParser);
  assert.ok(sanitizer > formParser);
  assert.ok(authRoutes > sanitizer);
});

test('raw webhook route remains mounted before the general JSON parser', () => {
  const webhookRoute = server.indexOf("app.use('/api/webhooks'");
  const jsonParser = server.indexOf("app.use(express.json");
  assert.ok(webhookRoute >= 0);
  assert.ok(jsonParser > webhookRoute);
});
