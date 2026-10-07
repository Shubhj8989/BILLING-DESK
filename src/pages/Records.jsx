import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import syncService from '../db/syncService';
import printModule from '../utils/print';
import { getAmountPaid, getBalanceDue, getPaymentStatus, formatDate, formatINR, getTodayDateStr } from '../utils/invoice';

const STATUS_COLORS = {
  Paid: { bg: 'var(--success-bg)', fg: 'var(--success)' },
  Partial: { bg: 'var(--warning-bg)', fg: 'var(--warning)' },
  Unpaid: { bg: 'var(--error-bg)', fg: 'var(--error)' }
};

export function StatusBadge({ invoice }) {
  const status = getPaymentStatus(invoice);
  const c = STATUS_COLORS[status];
  return (
    <span className="shop-status-badge" style={{ backgroundColor: c.bg, color: c.fg, padding: '2px 8px', fontSize: '10px', borderRadius: '4px', fontWeight: 600 }}>
      {status}
    </span>
  );
}

function PaymentModal({ invoice, onClose, onSaved }) {
  const due = getBalanceDue(invoice);
  const [amount, setAmount] = useState(String(due));
  const [mode, setMode] = useState('Cash');
  const [date, setDate] = useState(getTodayDateStr());
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (Number.isNaN(value) || value <= 0) {
      window.Toast.error('Enter a payment amount greater than zero.');
      return;
    }
    if (value > due + 0.001) {
      window.Toast.error(`Payment cannot exceed the balance due (${formatINR(due)}).`);
      return;
    }
    setSaving(true);
    try {
      const previousPaid = getAmountPaid(invoice);
      const history = invoice.payments?.length
        ? invoice.payments
        : (previousPaid > 0 ? [{ date: invoice.date, amount: previousPaid, mode: invoice.paymentMode }] : []);
      const updated = {
        ...invoice,
        amountPaid: Math.round((previousPaid + value) * 100) / 100,
        payments: [...history, { date, amount: value, mode }]
      };
      await syncService.updateInvoicePayment(updated);
      window.Toast.success(`Payment of ${formatINR(value)} recorded.`);
      onSaved(updated);
    } catch (err) {
      console.error('Payment save failed:', err);
      window.Toast.error('Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dialog-overlay active" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10001 }}>
      <div className="dialog-box" style={{ width: '380px', maxWidth: '95vw', transform: 'scale(1)', opacity: 1 }}>
        <div className="dialog-header">
          <h3>Record Payment · {invoice.invoiceNumber}</h3>
          <button className="dialog-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={submit}>
          <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Total {formatINR(invoice.grandTotal)} · Paid {formatINR(getAmountPaid(invoice))} · <strong style={{ color: 'var(--error)' }}>Due {formatINR(due)}</strong>
            </div>
            <label className="form-field-label">Amount (Rs.)
              <input type="number" step="any" min="0" className="form-control" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus required />
            </label>
            <label className="form-field-label">Payment Mode
              <select className="form-control" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option>Cash</option>
                <option>UPI</option>
                <option>Card</option>
                <option>Bank Transfer</option>
                <option>Cheque</option>
              </select>
            </label>
            <label className="form-field-label">Date
              <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            {invoice.payments?.length > 0 && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                <strong>Previous payments:</strong>
                {invoice.payments.map((p, i) => (
                  <div key={i}>{formatDate(p.date)} · {p.mode} · {formatINR(p.amount)}</div>
                ))}
              </div>
            )}
          </div>
          <div className="dialog-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Payment'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Records({ activeInvoice, setActiveInvoice, onEditInvoice, onDuplicateInvoice, canDelete }) {
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [paymentInvoice, setPaymentInvoice] = useState(null);

  const loadInvoices = async () => {
    try {
      setInvoices(await syncService.getInvoices());
    } catch (err) {
      console.error('Failed to load history:', err);
      window.Toast.error('Failed to load invoices.');
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [activeInvoice]);

  const q = search.trim().toLowerCase();
  const filteredInvoices = invoices.filter(inv => {
    if (q && !(
      (inv.invoiceNumber || '').toLowerCase().includes(q) ||
      (inv.customerName || '').toLowerCase().includes(q) ||
      (inv.customerMobile || '').includes(q)
    )) return false;
    if (fromDate && inv.date < fromDate) return false;
    if (toDate && inv.date > toDate) return false;
    if (modeFilter !== 'all' && inv.paymentMode !== modeFilter) return false;
    if (statusFilter === 'due' && getBalanceDue(inv) <= 0) return false;
    if (statusFilter === 'paid' && getBalanceDue(inv) > 0) return false;
    return true;
  });

  const filteredTotal = filteredInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const filteredDue = filteredInvoices.reduce((sum, inv) => sum + getBalanceDue(inv), 0);

  const handleDeleteInvoice = async (invoice) => {
    const confirm = await window.Dialog.confirm(`Permanently delete Invoice ${invoice.invoiceNumber}? Billed quantities will be added back to stock.`, 'Delete Saved Invoice', 'btn-danger');
    if (confirm) {
      try {
        await syncService.deleteInvoice(invoice);
        window.Toast.success('Invoice deleted successfully.');
        setActiveInvoice(null);
        loadInvoices();
      } catch (err) {
        console.error('Deletion failed:', err);
        window.Toast.error('Failed to delete invoice.');
      }
    }
  };

  const handleShareWhatsApp = (invoice) => {
    const shopName = invoice.shopConfig?.shopName || 'our shop';
    const due = getBalanceDue(invoice);
    const lines = [
      `Dear ${invoice.customerName},`,
      `Thank you for shopping at ${shopName}.`,
      `Invoice: ${invoice.invoiceNumber} dated ${formatDate(invoice.date)}`,
      `Amount: ${formatINR(invoice.grandTotal)}`,
      due > 0 ? `Balance due: ${formatINR(due)}` : 'Payment received in full.'
    ];
    const digits = (invoice.customerMobile || '').replace(/\D/g, '').slice(-10);
    const url = `https://wa.me/${digits ? '91' + digits : ''}?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener');
  };

  const handleExport = () => {
    if (filteredInvoices.length === 0) {
      window.Toast.warn('No invoices to export.');
      return;
    }
    const rows = filteredInvoices.map(inv => ({
      'Invoice No.': inv.invoiceNumber,
      'Date': formatDate(inv.date),
      'Customer': inv.customerName,
      'Mobile': inv.customerMobile || '',
      'GSTIN': inv.customerGstin || '',
      'Payment Mode': inv.paymentMode,
      'Taxable (INR)': Number((inv.subtotal || 0).toFixed(2)),
      'Tax (INR)': Number(((inv.cgstTotal || 0) + (inv.sgstTotal || 0) + (inv.igstTotal || 0)).toFixed(2)),
      'Grand Total (INR)': inv.grandTotal,
      'Paid (INR)': getAmountPaid(inv),
      'Balance Due (INR)': getBalanceDue(inv),
      'Status': getPaymentStatus(inv)
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, `Invoices_${getTodayDateStr()}.xlsx`);
    window.Toast.success('Invoice list exported.');
  };

  const clearFilters = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
    setStatusFilter('all');
    setModeFilter('all');
  };

  return (
    <div className="records-layout">
      {/* Search & Filter Bar */}
      <div className="table-actions-row records-filter-bar">
        <input
          type="text"
          className="form-control"
          placeholder="Search customer, mobile or invoice no…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '2 1 220px', textAlign: 'left' }}
        />
        <label className="filter-label">From
          <input type="date" className="form-control" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label className="filter-label">To
          <input type="date" className="form-control" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
        <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ flex: '0 1 130px' }}>
          <option value="all">All status</option>
          <option value="due">With dues</option>
          <option value="paid">Fully paid</option>
        </select>
        <select className="form-control" value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} style={{ flex: '0 1 130px' }}>
          <option value="all">All modes</option>
          <option value="Cash">Cash</option>
          <option value="UPI">UPI</option>
          <option value="Card">Card</option>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="Credit">Credit</option>
        </select>
        <button className="btn btn-secondary" onClick={clearFilters}>Clear</button>
        <button className="btn btn-secondary" onClick={handleExport}>📥 Excel</button>
      </div>

      <div className="records-summary">
        Showing <strong>{filteredInvoices.length}</strong> of {invoices.length} invoices · Total <strong>{formatINR(filteredTotal)}</strong>
        {filteredDue > 0 && <> · Outstanding <strong style={{ color: 'var(--error)' }}>{formatINR(filteredDue)}</strong></>}
      </div>

      {/* History table */}
      <div className="billing-table-container">
        <table className="billing-table">
          <thead>
            <tr>
              <th style={{ padding: '12px 8px' }}>Invoice No.</th>
              <th>Date</th>
              <th>Customer Name</th>
              <th>Mobile</th>
              <th>Payment Mode</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Balance Due</th>
              <th style={{ textAlign: 'right', paddingRight: '20px' }}>Grand Total (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                  No matching invoice records found in storage.
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => setActiveInvoice(inv)}
                  style={{ cursor: 'pointer' }}
                  className="hover-row"
                >
                  <td style={{ padding: '12px 8px' }}><strong>{inv.invoiceNumber}</strong></td>
                  <td>{formatDate(inv.date)} {inv.time}</td>
                  <td style={{ textAlign: 'left', fontWeight: '600' }}>{inv.customerName}</td>
                  <td>{inv.customerMobile || '-'}</td>
                  <td>
                    <span
                      className="shop-status-badge"
                      style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', fontSize: '10px', borderRadius: '4px' }}
                    >
                      {inv.paymentMode}
                    </span>
                  </td>
                  <td><StatusBadge invoice={inv} /></td>
                  <td style={{ textAlign: 'right', color: getBalanceDue(inv) > 0 ? 'var(--error)' : 'var(--text-muted)' }}>
                    {getBalanceDue(inv) > 0 ? formatINR(getBalanceDue(inv)) : '-'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '700', paddingRight: '20px' }}>
                    {formatINR(inv.grandTotal)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice Detail Viewer Modal */}
      {activeInvoice && (
        <div className="dialog-overlay active" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div className="dialog-box" style={{ width: '900px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
            
            {/* Modal Header Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)' }}>
              <div className="invoice-modal-actions">
                <button className="btn btn-primary" onClick={() => printModule.printInvoice(activeInvoice)}>🖨️ Print</button>
                <button className="btn btn-secondary" onClick={() => printModule.saveInvoiceAsPDF(activeInvoice)}>📥 PDF</button>
                {getBalanceDue(activeInvoice) > 0 && (
                  <button className="btn btn-success" onClick={() => setPaymentInvoice(activeInvoice)}>💰 Record Payment</button>
                )}
                <button className="btn btn-secondary" onClick={() => handleShareWhatsApp(activeInvoice)}>💬 WhatsApp</button>
                <button className="btn btn-secondary" onClick={() => onEditInvoice(activeInvoice)}>✏️ Edit</button>
                <button className="btn btn-secondary" onClick={() => onDuplicateInvoice(activeInvoice)}>📄 Duplicate</button>
                {canDelete && (
                  <button className="btn btn-danger" onClick={() => handleDeleteInvoice(activeInvoice)} style={{ backgroundColor: 'var(--error)', border: 'none', color: '#fff' }}>🗑️ Delete</button>
                )}
              </div>
              <button 
                onClick={() => setActiveInvoice(null)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '24px', cursor: 'pointer', padding: '4px 8px' }}
              >
                &times;
              </button>
            </div>

            {/* Scrollable Printable A4 Form Mock */}
            <div style={{ overflowY: 'auto', padding: '24px', backgroundColor: '#f1f5f9', display: 'flex', justifyContent: 'center' }}>
              <div 
                style={{
                  width: '100%',
                  maxWidth: '800px',
                  backgroundColor: '#fff',
                  padding: '24px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  borderRadius: '4px',
                  color: '#000',
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '11px',
                  lineHeight: '1.4'
                }}
              >
                {/* Embedded HTML preview template matching native Tally format */}
                <div style={{ textAlign: 'center', fontWeight: '800', fontSize: '15px', marginBottom: '8px', textTransform: 'uppercase' }}>Tax Invoice</div>
                
                <table style={{ width: '100%', border: '1.5px solid #000', borderCollapse: 'collapse' }}>
                  <tbody>
                  <tr>
                    <td style={{ width: '50%', border: '1px solid #000', padding: '6px', verticalAlign: 'top', height: '110px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', marginBottom: '4px', color: '#1e3a8a' }}>
                        {activeInvoice.shopConfig?.shopName || 'Vardhman Furniture House'}
                      </div>
                      <div>{activeInvoice.shopConfig?.address || ''}</div>
                      <div style={{ marginTop: '4px' }}><strong>GSTIN:</strong> {activeInvoice.shopConfig?.gstNumber || '09AZUPJ8074C1ZV'}</div>
                      <div><strong>State:</strong> {activeInvoice.shopConfig?.state || 'Uttar Pradesh'}</div>
                      {activeInvoice.shopConfig?.mobile && <div><strong>Mobile:</strong> {activeInvoice.shopConfig.mobile}</div>}
                    </td>
                    <td style={{ width: '50%', border: '1px solid #000', padding: '0', verticalAlign: 'top' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                        <tbody>
                        <tr>
                          <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '4px', width: '50%' }}>
                            <span style={{ fontSize: '8px', color: '#555', display: 'block' }}>Invoice No.</span>
                            <strong>{activeInvoice.invoiceNumber}</strong>
                          </td>
                          <td style={{ borderBottom: '1px solid #000', padding: '4px' }}>
                            <span style={{ fontSize: '8px', color: '#555', display: 'block' }}>Dated</span>
                            <strong>{formatDate(activeInvoice.date)}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '4px' }}>
                            <span style={{ fontSize: '8px', color: '#555', display: 'block' }}>Delivery Note</span>
                            <span>{activeInvoice.deliveryNote || '-'}</span>
                          </td>
                          <td style={{ borderBottom: '1px solid #000', padding: '4px' }}>
                            <span style={{ fontSize: '8px', color: '#555', display: 'block' }}>Mode of Payment</span>
                            <strong>{activeInvoice.paymentMode || 'Cash'}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td style={{ borderRight: '1px solid #000', padding: '4px' }}>
                            <span style={{ fontSize: '8px', color: '#555', display: 'block' }}>Buyer's Order No.</span>
                            <span>{activeInvoice.orderNo || '-'}</span>
                          </td>
                          <td style={{ padding: '4px' }}>
                            <span style={{ fontSize: '8px', color: '#555', display: 'block' }}>Terms of Delivery</span>
                            <span>{activeInvoice.termsDelivery || '-'}</span>
                          </td>
                        </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  {/* Buyer detail */}
                  <tr style={{ borderTop: '1px solid #000' }}>
                    <td style={{ width: '50%', border: '1px solid #000', padding: '6px', verticalAlign: 'top', height: '90px' }}>
                      <span style={{ fontSize: '8px', color: '#555', display: 'block', fontWeight: '600' }}>Buyer (Bill To)</span>
                      <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{activeInvoice.customerName}</div>
                      {activeInvoice.customerAddress && <div>{activeInvoice.customerAddress}</div>}
                      {activeInvoice.customerMobile && <div><strong>Mobile:</strong> {activeInvoice.customerMobile}</div>}
                      {activeInvoice.customerGstin && <div><strong>GSTIN:</strong> {activeInvoice.customerGstin}</div>}
                      <div><strong>State Name:</strong> {activeInvoice.customerState}</div>
                    </td>
                    <td style={{ width: '50%', border: '1px solid #000', padding: '4px', verticalAlign: 'top' }}>
                      <div><strong>Dispatch Details:</strong></div>
                      {activeInvoice.dispatchThrough && <div>Dispatched Through: {activeInvoice.dispatchThrough}</div>}
                      {activeInvoice.destination && <div>Destination: {activeInvoice.destination}</div>}
                    </td>
                  </tr>
                  </tbody>
                </table>

                {/* Items Grid */}
                <table style={{ width: '100%', border: '1.5px solid #000', borderTop: 'none', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9' }}>
                      <th style={{ border: '1px solid #000', padding: '4px', width: '5%', textAlign: 'center' }}>Sl</th>
                      <th style={{ border: '1px solid #000', padding: '4px', width: '45%', textAlign: 'left' }}>Description of Goods</th>
                      <th style={{ border: '1px solid #000', padding: '4px', width: '10%', textAlign: 'center' }}>HSN/SAC</th>
                      <th style={{ border: '1px solid #000', padding: '4px', width: '8%', textAlign: 'center' }}>Qty</th>
                      <th style={{ border: '1px solid #000', padding: '4px', width: '10%', textAlign: 'right' }}>Rate</th>
                      <th style={{ border: '1px solid #000', padding: '4px', width: '5%', textAlign: 'center' }}>per</th>
                      <th style={{ border: '1px solid #000', padding: '4px', width: '8%', textAlign: 'center' }}>Discount</th>
                      <th style={{ border: '1px solid #000', padding: '4px', width: '12%', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeInvoice.items.map((item, idx) => (
                      <tr key={idx} style={{ height: '24px', verticalAlign: 'top' }}>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', textAlign: 'center', padding: '2px' }}>{idx + 1}</td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', padding: '2px' }}><strong>{item.name}</strong></td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', textAlign: 'center', padding: '2px' }}>{item.hsn || '-'}</td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', textAlign: 'center', padding: '2px', fontWeight: 'bold' }}>{item.qty} {item.unit}</td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', textAlign: 'right', padding: '2px' }}>{item.rate.toFixed(2)}</td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', textAlign: 'center', padding: '2px' }}>{item.unit}</td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', textAlign: 'center', padding: '2px' }}>
                          {item.discount > 0 ? (item.discountType === 'amount' ? 'Rs.' + item.discount : item.discount + '%') : ''}
                        </td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', textAlign: 'right', padding: '2px', fontWeight: 'bold' }}>{item.taxableAmount.toFixed(2)}</td>
                      </tr>
                    ))}

                    {/* Freight Row */}
                    {activeInvoice.freight > 0 && (
                      <tr style={{ height: '20px', verticalAlign: 'top' }}>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', padding: '2px', textAlign: 'right', fontStyle: 'italic', fontWeight: 'bold' }}>Freight Out</td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', textAlign: 'center', padding: '2px' }}>996511</td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', textAlign: 'right', padding: '2px', fontWeight: 'bold' }}>{activeInvoice.freight.toFixed(2)}</td>
                      </tr>
                    )}

                    {/* CGST / SGST split */}
                    {activeInvoice.isLocal ? (
                      <>
                        <tr style={{ height: '20px', verticalAlign: 'top' }}>
                          <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                          <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', padding: '2px', textAlign: 'right', fontStyle: 'italic', fontWeight: 'bold' }}>CGST</td>
                          <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                          <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                          <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                          <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                          <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                          <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', textAlign: 'right', padding: '2px', fontWeight: 'bold' }}>{activeInvoice.cgstTotal.toFixed(2)}</td>
                        </tr>
                        <tr style={{ height: '20px', verticalAlign: 'top' }}>
                          <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                          <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', padding: '2px', textAlign: 'right', fontStyle: 'italic', fontWeight: 'bold' }}>SGST</td>
                          <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                          <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                          <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                          <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                          <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                          <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', textAlign: 'right', padding: '2px', fontWeight: 'bold' }}>{activeInvoice.sgstTotal.toFixed(2)}</td>
                        </tr>
                      </>
                    ) : (
                      <tr style={{ height: '20px', verticalAlign: 'top' }}>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', padding: '2px', textAlign: 'right', fontStyle: 'italic', fontWeight: 'bold' }}>IGST</td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', textAlign: 'right', padding: '2px', fontWeight: 'bold' }}>{activeInvoice.igstTotal.toFixed(2)}</td>
                      </tr>
                    )}

                    {/* Extra Cash Discount row */}
                    {activeInvoice.extraDiscount > 0 && (
                      <tr style={{ height: '20px', verticalAlign: 'top' }}>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', padding: '2px', textAlign: 'right', color: '#b91c1c', fontStyle: 'italic', fontWeight: 'bold' }}>Less: Extra Cash Discount</td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                        <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', textAlign: 'right', padding: '2px', color: '#b91c1c', fontWeight: 'bold' }}>- {activeInvoice.extraDiscount.toFixed(2)}</td>
                      </tr>
                    )}

                    {/* Rounding Off row */}
                    <tr style={{ height: '20px', verticalAlign: 'top' }}>
                      <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                      <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', padding: '2px', textAlign: 'right', fontStyle: 'italic' }}>Rounding Off</td>
                      <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                      <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                      <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                      <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                      <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}></td>
                      <td style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000', textAlign: 'right', padding: '2px' }}>{(activeInvoice.roundOff >= 0 ? '+' : '')}{activeInvoice.roundOff.toFixed(2)}</td>
                    </tr>

                    {/* Totals row */}
                    <tr style={{ borderTop: '1.5px solid #000', borderBottom: '1.5px solid #000', fontWeight: 'bold', backgroundColor: '#f1f5f9' }}>
                      <td style={{ border: '1px solid #000' }}></td>
                      <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>TOTAL</td>
                      <td style={{ border: '1px solid #000' }}></td>
                      <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{activeInvoice.items.reduce((sum, item) => sum + item.qty, 0)}</td>
                      <td style={{ border: '1px solid #000' }}></td>
                      <td style={{ border: '1px solid #000' }}></td>
                      <td style={{ border: '1px solid #000' }}></td>
                      <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>Rs.{activeInvoice.grandTotal.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Amount in words */}
                <div style={{ border: '1.5px solid #000', borderTop: 'none', padding: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    Amount Chargeable (in words):<br />
                    <strong style={{ textTransform: 'uppercase' }}>INR {activeInvoice.amountInWords}</strong>
                  </div>
                  <div style={{ fontStyle: 'italic', fontWeight: 'bold', alignSelf: 'flex-end' }}>E. & O.E.</div>
                </div>
                <div style={{ border: '1.5px solid #000', borderTop: 'none', padding: '6px 8px', display: 'flex', gap: '24px', fontSize: '10px', flexWrap: 'wrap' }}>
                  <span>Amount Received: <strong>Rs. {getAmountPaid(activeInvoice).toFixed(2)}</strong></span>
                  <span>Balance Due: <strong style={{ color: getBalanceDue(activeInvoice) > 0 ? '#b91c1c' : '#000' }}>Rs. {getBalanceDue(activeInvoice).toFixed(2)}</strong></span>
                  {activeInvoice.createdBy && <span style={{ marginLeft: 'auto', color: '#555' }}>Billed by: {activeInvoice.createdBy}</span>}
                </div>

                {/* Bank / Declaration */}
                <table style={{ width: '100%', border: '1.5px solid #000', borderTop: 'none', borderCollapse: 'collapse', marginTop: '0' }}>
                  <tbody>
                  <tr>
                    <td style={{ width: '55%', borderRight: '1px solid #000', padding: '6px', fontSize: '9.5px', lineHeight: '1.4' }}>
                      <div>Company PAN: <strong>{activeInvoice.shopConfig?.gstNumber ? activeInvoice.shopConfig.gstNumber.substring(2, 12) : ''}</strong></div>
                      {activeInvoice.shopConfig?.bankAccount && (
                        <div style={{ marginTop: '6px', borderTop: '1px dashed #ccc', paddingTop: '4px' }}>
                          <strong>Bank Accounts details:</strong><br />
                          A/C: <strong>{activeInvoice.shopConfig.bankAccount}</strong> | IFSC: <strong>{activeInvoice.shopConfig.bankIfsc}</strong> | Proprietor: <strong>{activeInvoice.shopConfig.proprietor}</strong>
                        </div>
                      )}
                      <div style={{ marginTop: '8px' }}>
                        <strong>Declaration:</strong> We declare that this invoice shows the actual price of the goods described.
                      </div>
                    </td>
                    <td style={{ width: '45%', padding: '8px', textAlign: 'center', verticalAlign: 'top', height: '80px' }}>
                      <div style={{ fontSize: '9px', marginBottom: '30px' }}>for <strong>{activeInvoice.shopConfig?.shopName || 'Vardhman Furniture House'}</strong></div>
                      <div style={{ borderTop: '1px dashed #000', width: '80%', margin: '0 auto', fontSize: '9px' }}>Proprietor Signature</div>
                    </td>
                  </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {paymentInvoice && (
        <PaymentModal
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSaved={(updated) => {
            setPaymentInvoice(null);
            setActiveInvoice(updated);
            loadInvoices();
          }}
        />
      )}
    </div>
  );
}
