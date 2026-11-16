function buildStaffSalesLookup(rows = []) {
  const lookup = new Map();

  for (const row of rows) {
    if (!row?._id) continue;
    lookup.set(String(row._id), {
      salesCount: Number(row.salesCount) || 0,
      salesTotal: Number(row.salesTotal) || 0
    });
  }

  return lookup;
}

module.exports = { buildStaffSalesLookup };
