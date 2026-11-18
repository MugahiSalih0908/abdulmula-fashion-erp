export function mergeDailySeries(salesByDay = [], expensesByDay = []) {
  const byDate = new Map();

  for (const sale of salesByDay) {
    if (!sale?._id) continue;
    byDate.set(sale._id, {
      date: sale._id,
      revenue: Number(sale.revenue) || 0,
      salesCount: Number(sale.count) || 0,
      expenses: 0
    });
  }

  for (const expense of expensesByDay) {
    if (!expense?._id) continue;
    const current = byDate.get(expense._id) || {
      date: expense._id,
      revenue: 0,
      salesCount: 0,
      expenses: 0
    };
    current.expenses = Number(expense.total) || 0;
    byDate.set(expense._id, current);
  }

  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => ({
      ...item,
      revenueLessExpenses: item.revenue - item.expenses
    }));
}

export function buildMonthlySeries(monthly = [], monthNames = []) {
  return monthly
    .filter(item => Number.isInteger(item?._id?.year) && Number.isInteger(item?._id?.month))
    .map(item => ({
      key: String(item._id.year) + '-' + String(item._id.month).padStart(2, '0'),
      name: (monthNames[item._id.month - 1] || 'Month') + ' ' + item._id.year,
      year: item._id.year,
      month: item._id.month,
      revenue: Number(item.revenue) || 0,
      count: Number(item.count) || 0
    }))
    .sort((a, b) => a.year - b.year || a.month - b.month);
}

export function isInvalidReportDateRange(startDate, endDate) {
  if (!startDate || !endDate) return false;
  const start = new Date(startDate + 'T00:00:00.000Z');
  const end = new Date(endDate + 'T00:00:00.000Z');
  return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end;
}

export function getRevenueLessExpenses(revenue, expenses) {
  const sales = Number(revenue);
  const costs = Number(expenses);
  return (Number.isFinite(sales) ? sales : 0) - (Number.isFinite(costs) ? costs : 0);
}
