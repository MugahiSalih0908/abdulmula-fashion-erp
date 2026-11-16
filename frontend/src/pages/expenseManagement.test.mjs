import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPENSE_CATEGORIES,
  filterExpenses,
  isValidExpensePayload,
  normalizeExpensePayload,
  summarizeExpenses
} from './expenseManagement.mjs';

const expenses = [
  { _id: '1', title: 'Shop rent', category: 'Rent', amount: 500, description: 'November rent' },
  { _id: '2', title: 'Transport delivery', category: 'Transport', amount: 40, description: 'Fabric delivery' },
  { _id: '3', title: 'Staff salaries', category: 'Salaries', amount: 300, description: '' }
];

test('expense search matches title, category and description case-insensitively', () => {
  assert.deepEqual(filterExpenses(expenses, 'SHOP').map(item => item._id), ['1']);
  assert.deepEqual(filterExpenses(expenses, 'transport').map(item => item._id), ['2']);
  assert.deepEqual(filterExpenses(expenses, 'FABRIC').map(item => item._id), ['2']);
});

test('expense summary calculates total, average, largest and category shares', () => {
  const summary = summarizeExpenses(expenses);
  assert.equal(summary.count, 3);
  assert.equal(summary.total, 840);
  assert.equal(summary.average, 280);
  assert.equal(summary.largest, 500);
  assert.deepEqual(summary.categoryBreakdown.map(item => item.category), ['Rent', 'Salaries', 'Transport']);
  assert.ok(Math.abs(summary.categoryBreakdown[0].share - 500 / 840 * 100) < 1e-9);
});

test('expense summary safely ignores invalid numeric values', () => {
  const summary = summarizeExpenses([
    { title: 'Valid', amount: 25, category: 'Other' },
    { title: 'Invalid', amount: 'bad', category: 'Rent' },
    { title: 'Negative', amount: -2, category: 'Rent' }
  ]);
  assert.equal(summary.count, 1);
  assert.equal(summary.total, 25);
  assert.equal(summary.average, 25);
  assert.equal(summary.largest, 25);
  assert.deepEqual(summary.categoryBreakdown, [{ category: 'Other', amount: 25, share: 100 }]);
});

test('expense payload trims text and converts amount to number', () => {
  assert.deepEqual(normalizeExpensePayload({
    title: '  Monthly rent ',
    amount: '125.50',
    category: 'Rent',
    description: '  Shop unit 4 ',
    date: '2026-11-01'
  }), {
    title: 'Monthly rent',
    amount: 125.5,
    category: 'Rent',
    description: 'Shop unit 4',
    date: '2026-11-01'
  });
});

test('expense payload validation enforces required values and schema limits', () => {
  const valid = { title: 'Rent', amount: '125', category: 'Rent', date: '2026-11-01', description: 'Shop rent' };
  assert.equal(isValidExpensePayload(valid), true);
  assert.equal(isValidExpensePayload({ ...valid, title: ' ' }), false);
  assert.equal(isValidExpensePayload({ ...valid, amount: -1 }), false);
  assert.equal(isValidExpensePayload({ ...valid, category: 'Unknown' }), false);
  assert.equal(isValidExpensePayload({ ...valid, date: 'not-a-date' }), false);
  assert.equal(isValidExpensePayload({ ...valid, title: 'R'.repeat(121) }), false);
});

test('expense categories match the backend schema', () => {
  assert.deepEqual(EXPENSE_CATEGORIES, [
    'Rent', 'Transport', 'Salaries', 'Electricity',
    'Stock Purchase', 'Marketing', 'Maintenance', 'Other'
  ]);
});
