// src/utils/whatsapp.js – share invoice via WhatsApp

/**
 * Build a WhatsApp-ready invoice text and open wa.me link
 * @param {object} invoice  – Invoice document from API
 * @param {string} phone    – customer phone (optional)
 */
export const shareInvoiceWhatsApp = (invoice, phone = '') => {
  const lines = [
    '*ABDULMULA FASHION*',
    'Konyo-Konyo Market, Juba, South Sudan',
    '━━━━━━━━━━━━━━━━━━',
    `*Invoice:* ${invoice.invoiceNumber}`,
    `*Date:* ${new Date(invoice.date).toLocaleDateString()}`,
    invoice.customerName ? `*Customer:* ${invoice.customerName}` : '',
    invoice.soldByName   ? `*Cashier:* ${invoice.soldByName}`    : '',
    '━━━━━━━━━━━━━━━━━━',
    '*ITEMS:*',
    ...(invoice.items || []).map(i =>
      `• ${i.productName}  ${i.quantity}×$${i.unitPrice?.toFixed(2)} = *$${i.lineTotal?.toFixed(2)}*`
    ),
    '━━━━━━━━━━━━━━━━━━',
    invoice.discountTotal > 0 ? `Discount: -$${invoice.discountTotal?.toFixed(2)}` : '',
    `*TOTAL: $${invoice.grandTotal?.toFixed(2)}*`,
    `Payment: ${invoice.paymentMethod}`,
    invoice.balanceDue > 0 ? `⚠️ Balance Due: $${invoice.balanceDue?.toFixed(2)}` : '✅ Paid in full',
    '',
    '_Thank you for shopping at Abdulmula Fashion!_'
  ].filter(l => l !== '').join('\n');

  const encoded = encodeURIComponent(lines);
  const url     = phone
    ? `https://wa.me/${phone.replace(/\D/g,'')}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  window.open(url, '_blank');
};
