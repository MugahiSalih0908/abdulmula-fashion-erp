export const EXPENSE_CATEGORIES = [
  'Rent', 'Transport', 'Salaries', 'Electricity',
  'Stock Purchase', 'Marketing', 'Maintenance', 'Other'
];

export function filterExpenses(expenses = [], search = '') {
  const query = String(search || '').trim().toLocaleLowerCase();
  if (!query) return expenses;
  return expenses.filter(expense => [
    expense.title, expense.category, expense.description
  ].filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
}

export function summarizeExpenses(expenses = []) {
  const summary = { count: 0, total: 0, average: 0, largest: 0, categoryBreakdown: [] };
  const byCategory = new Map();

  for (const expense of expenses) {
    const amount = Number(expense.amount);
    if (!Number.isFinite(amount) || amount < 0) continue;
    summary.count += 1;
    summary.total += amount;
    summary.largest = Math.max(summary.largest, amount);
    const category = expense.category || 'Other';
    byCategory.set(category, (byCategory.get(category) || 0) + amount);
  }

  summary.average = summary.count ? summary.total / summary.count : 0;
  summary.categoryBreakdown = [...byCategory.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      share: summary.total > 0 ? amount / summary.total * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);
  return summary;
}

export function normalizeExpensePayload(values = {}) {
  return {
    title: String(values.title ?? '').trim(),
    amount: Number(values.amount),
    category: String(values.category || 'Other'),
    description: String(values.description ?? '').trim(),
    date: String(values.date ?? '')
  };
}

export function isValidExpensePayload(values = {}) {
  const payload = normalizeExpensePayload(values);
  return Boolean(
    payload.title &&
    payload.title.length <= 120 &&
    Number.isFinite(payload.amount) &&
    payload.amount > 0 &&
    EXPENSE_CATEGORIES.includes(payload.category) &&
    /^\d{4}-\d{2}-\d{2}$/.test(payload.date) &&
    payload.description.length <= 300
  );
}
