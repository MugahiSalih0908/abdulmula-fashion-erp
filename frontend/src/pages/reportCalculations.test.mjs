import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthlySeries,
  getRevenueLessExpenses,
  isInvalidReportDateRange,
  mergeDailySeries
} from './reportCalculations.mjs';

test('daily report combines sales and expenses and keeps expense-only dates', () => {
  assert.deepEqual(mergeDailySeries([
    { _id: '2026-11-14', revenue: 150, count: 3 },
    { _id: '2026-11-16', revenue: 75, count: 1 }
  ], [
    { _id: '2026-11-13', total: 20 },
    { _id: '2026-11-14', total: 30 }
  ]), [
    { date: '2026-11-13', revenue: 0, salesCount: 0, expenses: 20, revenueLessExpenses: -20 },
    { date: '2026-11-14', revenue: 150, salesCount: 3, expenses: 30, revenueLessExpenses: 120 },
    { date: '2026-11-16', revenue: 75, salesCount: 1, expenses: 0, revenueLessExpenses: 75 }
  ]);
});

test('monthly report labels include the year and sort chronologically', () => {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  assert.deepEqual(buildMonthlySeries([
    { _id: { year: 2026, month: 1 }, revenue: 10, count: 1 },
    { _id: { year: 2025, month: 12 }, revenue: 20, count: 2 }
  ], monthNames).map(item => [item.key, item.name]), [
    ['2025-12', 'Dec 2025'],
    ['2026-01', 'Jan 2026']
  ]);
});

test('report range validation catches reversed and invalid ranges', () => {
  assert.equal(isInvalidReportDateRange('2026-11-01', '2026-11-16'), false);
  assert.equal(isInvalidReportDateRange('2026-11-16', '2026-11-01'), true);
  assert.equal(isInvalidReportDateRange('bad-date', '2026-11-16'), true);
  assert.equal(isInvalidReportDateRange('', '2026-11-16'), false);
});

test('revenue less expenses is not mislabeled as net profit', () => {
  assert.equal(getRevenueLessExpenses(1000, 250), 750);
  assert.equal(getRevenueLessExpenses('bad', 20), -20);
});
