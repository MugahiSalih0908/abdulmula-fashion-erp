import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBaseUrl } from './apiUrl.mjs';

test('defaults to the production HTTPS API', () => {
  assert.equal(resolveApiBaseUrl('', true), 'https://abdulmula-fashion-erp.onrender.com/api');
});

test('normalizes HTTPS API paths', () => {
  assert.equal(resolveApiBaseUrl('https://api.example.com/api/api/', true), 'https://api.example.com/api');
});

test('rejects HTTP outside local development', () => {
  assert.throws(() => resolveApiBaseUrl('http://api.example.com/api', true), /must use HTTPS/);
  assert.throws(() => resolveApiBaseUrl('http://api.example.com/api', false), /must use HTTPS/);
});

test('allows HTTP only for local development', () => {
  assert.equal(resolveApiBaseUrl('http://localhost:5000/api', false), 'http://localhost:5000/api');
  assert.throws(() => resolveApiBaseUrl('http://localhost:5000/api', true), /must use HTTPS/);
});

test('rejects embedded credentials or URL parameters', () => {
  assert.throws(() => resolveApiBaseUrl('https://user:pass@example.com/api', true), /cannot contain credentials/);
});
