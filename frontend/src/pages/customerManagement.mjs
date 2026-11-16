const optionalText = value => {
  const text = String(value ?? '').trim();
  return text || undefined;
};

export function normalizeCustomerPayload(values = {}) {
  return {
    name: String(values.name ?? '').trim(),
    email: optionalText(values.email)?.toLowerCase(),
    phone: optionalText(values.phone),
    address: optionalText(values.address),
    notes: optionalText(values.notes)
  };
}

export function filterCustomers(customers = [], search = '', hasCredit = false) {
  const query = String(search || '').trim().toLocaleLowerCase();

  return customers.filter(customer => {
    if (hasCredit && !(Number(customer.creditBalance) > 0)) return false;
    if (!query) return true;

    const haystack = [
      customer.name,
      customer.email,
      customer.phone,
      customer.address
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();

    return haystack.includes(query);
  });
}

export function summarizeCustomers(customers = []) {
  return customers.reduce((summary, customer) => {
    const purchases = Number(customer.totalPurchases);
    const credit = Number(customer.creditBalance);

    summary.count += 1;
    summary.totalPurchases += Number.isFinite(purchases) ? purchases : 0;
    summary.outstandingCredit += Number.isFinite(credit) ? credit : 0;
    if (Number.isFinite(credit) && credit > 0) summary.withCredit += 1;
    if (customer.email) summary.withEmail += 1;
    if (customer.phone) summary.withPhone += 1;

    return summary;
  }, {
    count: 0,
    totalPurchases: 0,
    outstandingCredit: 0,
    withCredit: 0,
    withEmail: 0,
    withPhone: 0
  });
}

export function getCustomerInitials(name = '') {
  const parts = String(name).trim().split(/\\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'CU';
}
