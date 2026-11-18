function buildLineCostSnapshot(product) {
  const unitCost = Number(product?.costPrice);
  if (!Number.isFinite(unitCost) || unitCost <= 0) return { costKnown: false };
  return { unitCost, costKnown: true };
}

module.exports = { buildLineCostSnapshot };
