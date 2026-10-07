// Amount already received for an invoice. Older invoices have no amountPaid field:
// treat them as fully paid unless they were billed on credit.
export function getAmountPaid(invoice) {
  if (invoice.amountPaid !== undefined && invoice.amountPaid !== null) return Number(invoice.amountPaid) || 0;
  return invoice.paymentMode === 'Credit' ? 0 : Number(invoice.grandTotal) || 0;
}

export function getBalanceDue(invoice) {
  return Math.max(0, Math.round(((Number(invoice.grandTotal) || 0) - getAmountPaid(invoice)) * 100) / 100);
}

export function getPaymentStatus(invoice) {
  const due = getBalanceDue(invoice);
  if (due <= 0) return 'Paid';
  return getAmountPaid(invoice) > 0 ? 'Partial' : 'Unpaid';
}

export function formatINR(value) {
  const num = Number(value) || 0;
  return 'Rs. ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getTodayDateStr() {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);
  return localNow.toISOString().split('T')[0];
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return d && m && y ? `${d}/${m}/${y}` : dateStr;
}
