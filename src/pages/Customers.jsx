import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import syncService from '../db/syncService';
import { StatusBadge } from './Records';
import { getAmountPaid, getBalanceDue, formatDate, formatINR, getTodayDateStr } from '../utils/invoice';

// Customers are derived from invoice history, keyed by mobile (or name for walk-ins without a number)
function buildCustomers(invoices) {
  const map = new Map();
  invoices.forEach(inv => {
    if (!inv.customerName || inv.customerName === 'Walk-in Customer') return;
    const key = inv.customerMobile || `name:${inv.customerName.trim().toLowerCase()}`;
    if (!map.has(key)) {
      // invoices arrive newest-first, so the first one carries the latest details
      map.set(key, {
        key,
        name: inv.customerName,
        mobile: inv.customerMobile || '',
        address: inv.customerAddress || '',
        gstin: inv.customerGstin || '',
        state: inv.customerState || '',
        invoices: [],
        totalBilled: 0,
        totalPaid: 0,
        balance: 0,
        lastDate: inv.date
      });
    }
    const c = map.get(key);
    c.invoices.push(inv);
    c.totalBilled += inv.grandTotal || 0;
    c.totalPaid += getAmountPaid(inv);
    c.balance += getBalanceDue(inv);
    if (inv.date > c.lastDate) c.lastDate = inv.date;
  });
  return [...map.values()];
}

export default function Customers({ onNewBill, onViewInvoice }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [onlyDues, setOnlyDues] = useState(false);
  const [sortBy, setSortBy] = useState('balance');
  const [expanded, setExpanded] = useState(null);
  const [shopName, setShopName] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [invoices, settings] = await Promise.all([syncService.getInvoices(), syncService.getSettings()]);
        setCustomers(buildCustomers(invoices));
        setShopName(settings.shopName || '');
      } catch (err) {
        console.error('Failed to load customers:', err);
        window.Toast.error('Failed to load customers.');
      }
    }
    load();
  }, []);

  const q = search.trim().toLowerCase();
  const visible = customers
    .filter(c => !onlyDues || c.balance > 0)
    .filter(c => !q || c.name.toLowerCase().includes(q) || c.mobile.includes(q) || c.gstin.toLowerCase().includes(q))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'billed') return b.totalBilled - a.totalBilled;
      if (sortBy === 'recent') return b.lastDate.localeCompare(a.lastDate);
      return b.balance - a.balance || b.totalBilled - a.totalBilled;
    });

  const totalOutstanding = customers.reduce((sum, c) => sum + c.balance, 0);
  const debtors = customers.filter(c => c.balance > 0).length;

  const sendReminder = (c) => {
    const digits = c.mobile.replace(/\D/g, '').slice(-10);
    if (!digits) {
      window.Toast.warn('This customer has no mobile number on record.');
      return;
    }
    const pending = c.invoices.filter(inv => getBalanceDue(inv) > 0)
      .map(inv => `${inv.invoiceNumber} (${formatDate(inv.date)}): ${formatINR(getBalanceDue(inv))}`);
    const text = [
      `Dear ${c.name},`,
      `This is a gentle reminder from ${shopName || 'our shop'} about your pending balance of ${formatINR(c.balance)}.`,
      ...pending,
      'Kindly clear the dues at your earliest convenience. Thank you!'
    ].join('\n');
    window.open(`https://wa.me/91${digits}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const handleExport = () => {
    if (visible.length === 0) {
      window.Toast.warn('No customers to export.');
      return;
    }
    const rows = visible.map(c => ({
      'Customer': c.name,
      'Mobile': c.mobile,
      'GSTIN': c.gstin,
      'Address': c.address,
      'Invoices': c.invoices.length,
      'Total Billed (INR)': Number(c.totalBilled.toFixed(2)),
      'Paid (INR)': Number(c.totalPaid.toFixed(2)),
      'Outstanding (INR)': Number(c.balance.toFixed(2)),
      'Last Purchase': formatDate(c.lastDate)
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, `Customers_${getTodayDateStr()}.xlsx`);
    window.Toast.success('Customer list exported.');
  };

  return (
    <div className="customers-layout" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="report-summary-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div className="card metric-card" style={{ padding: '16px' }}>
          <div className="metric-info">
            <span className="metric-title">Total Customers</span>
            <span className="metric-value" style={{ fontSize: '20px' }}>{customers.length}</span>
          </div>
        </div>
        <div className="card metric-card" style={{ padding: '16px' }}>
          <div className="metric-info">
            <span className="metric-title">Customers with Dues</span>
            <span className="metric-value" style={{ fontSize: '20px' }}>{debtors}</span>
          </div>
        </div>
        <div className="card metric-card" style={{ padding: '16px' }}>
          <div className="metric-info">
            <span className="metric-title">Total Outstanding</span>
            <span className="metric-value" style={{ fontSize: '20px', color: totalOutstanding > 0 ? 'var(--error)' : undefined }}>{formatINR(totalOutstanding)}</span>
          </div>
        </div>
      </div>

      <div className="table-actions-row records-filter-bar">
        <input
          type="text"
          className="form-control"
          placeholder="Search name, mobile or GSTIN…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '2 1 220px', textAlign: 'left' }}
        />
        <select className="form-control" value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ flex: '0 1 170px' }}>
          <option value="balance">Sort: Highest dues</option>
          <option value="billed">Sort: Top buyers</option>
          <option value="recent">Sort: Recent purchase</option>
          <option value="name">Sort: Name A–Z</option>
        </select>
        <label className="auth-check" style={{ fontSize: '12.5px' }}>
          <input type="checkbox" checked={onlyDues} onChange={(e) => setOnlyDues(e.target.checked)} /> Only with dues
        </label>
        <button className="btn btn-secondary" onClick={handleExport}>📥 Excel</button>
      </div>

      <div className="billing-table-container">
        <table className="billing-table">
          <thead>
            <tr>
              <th style={{ padding: '12px 8px' }}>Customer</th>
              <th>Mobile</th>
              <th style={{ textAlign: 'center' }}>Invoices</th>
              <th>Last Purchase</th>
              <th style={{ textAlign: 'right' }}>Total Billed</th>
              <th style={{ textAlign: 'right' }}>Outstanding</th>
              <th style={{ width: '220px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                  {customers.length === 0 ? 'Customers appear here automatically once you save invoices with a customer name.' : 'No customers match your filters.'}
                </td>
              </tr>
            ) : visible.map(c => (
              <React.Fragment key={c.key}>
                <tr className="hover-row" style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === c.key ? null : c.key)}>
                  <td style={{ padding: '12px 8px', textAlign: 'left' }}>
                    <div style={{ fontWeight: 600 }}>{expanded === c.key ? '▾' : '▸'} {c.name}</div>
                    {c.gstin && <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>GSTIN: {c.gstin}</div>}
                  </td>
                  <td>{c.mobile || '-'}</td>
                  <td style={{ textAlign: 'center' }}>{c.invoices.length}</td>
                  <td>{formatDate(c.lastDate)}</td>
                  <td style={{ textAlign: 'right' }}>{formatINR(c.totalBilled)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: c.balance > 0 ? 'var(--error)' : 'var(--success)' }}>
                    {c.balance > 0 ? formatINR(c.balance) : 'Nil'}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => onNewBill(c)}>🧾 New Bill</button>
                      {c.balance > 0 && (
                        <button className="btn btn-secondary btn-sm" onClick={() => sendReminder(c)}>💬 Remind</button>
                      )}
                    </div>
                  </td>
                </tr>
                {expanded === c.key && (
                  <tr>
                    <td colSpan="7" style={{ background: 'var(--bg-app)', padding: '8px 16px' }}>
                      {c.address && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', textAlign: 'left' }}>📍 {c.address}{c.state ? `, ${c.state}` : ''}</div>}
                      <table className="billing-table" style={{ margin: 0 }}>
                        <tbody>
                          {c.invoices.map(inv => (
                            <tr key={inv.id} className="hover-row" style={{ cursor: 'pointer' }} onClick={() => onViewInvoice(inv)}>
                              <td style={{ padding: '6px 8px' }}><strong>{inv.invoiceNumber}</strong></td>
                              <td>{formatDate(inv.date)}</td>
                              <td>{inv.paymentMode}</td>
                              <td><StatusBadge invoice={inv} /></td>
                              <td style={{ textAlign: 'right' }}>{formatINR(inv.grandTotal)}</td>
                              <td style={{ textAlign: 'right', color: getBalanceDue(inv) > 0 ? 'var(--error)' : 'var(--text-muted)' }}>
                                {getBalanceDue(inv) > 0 ? `Due ${formatINR(getBalanceDue(inv))}` : 'Paid'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
