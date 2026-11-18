const optionalText = value => {
  const text = String(value ?? '').trim();
  return text || undefined;
};

export function normalizeSupplierPayload(values = {}) {
  const payload = { name: String(values.name ?? '').trim() };
  const company = optionalText(values.company);
  const email = optionalText(values.email);
  const phone = optionalText(values.phone);
  const address = optionalText(values.address);
  const notes = optionalText(values.notes);

  if (company) payload.company = company;
  if (email) payload.email = email.toLowerCase();
  if (phone) payload.phone = phone;
  if (address) payload.address = address;
  if (notes) payload.notes = notes;

  return payload;
}

export function filterSuppliers(suppliers = [], search = '', hasDebt = false) {
  const query = String(search || '').trim().toLocaleLowerCase();

  return suppliers.filter(supplier => {
    if (hasDebt && !(Number(supplier.debtBalance) > 0)) return false;
    if (!query) return true;

    const haystack = [
      supplier.name,
      supplier.company,
      supplier.email,
      supplier.phone,
      supplier.address
    ].filter(Boolean).join(' ').toLocaleLowerCase();

    return haystack.includes(query);
  });
}

export function summarizeSuppliers(suppliers = []) {
  return suppliers.reduce((summary, supplier) => {
    const debt = Number(supplier.debtBalance);
    summary.count += 1;
    summary.totalDebt += Number.isFinite(debt) ? debt : 0;
    if (Number.isFinite(debt) && debt > 0) summary.withDebt += 1;
    if (supplier.phone) summary.withPhone += 1;
    if (supplier.email) summary.withEmail += 1;
    return summary;
  }, { count: 0, totalDebt: 0, withDebt: 0, withPhone: 0, withEmail: 0 });
}

export function getSupplierInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'SU';
}
