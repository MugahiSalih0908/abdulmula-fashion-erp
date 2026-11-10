export function getSellableUnitCount(stock) {
  if (!Number.isInteger(stock) || stock <= 0) return 0;
  return stock;
}

export function getStockStatus(stock) {
  if (!Number.isFinite(stock) || !Number.isInteger(stock) || stock < 0) return 'invalid-stock';
  if (stock === 0) return 'out-of-stock';
  return 'available';
}
