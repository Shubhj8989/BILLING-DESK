import React, { useState, useEffect } from 'react';
import syncService from '../db/syncService';
import { getBalanceDue, formatDate, formatINR, getTodayDateStr } from '../utils/invoice';

export default function Dashboard({ onViewInvoice, setActivePage, shopConfig = {}, user }) {
  const [stats, setStats] = useState({
    todaySales: 0,
    todayCount: 0,
    monthSales: 0,
    outstanding: 0,
    dueCount: 0,
    totalInvoices: 0,
    totalProducts: 0
  });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const isAdmin = user?.role === 'admin';
  const threshold = Number(shopConfig.lowStockThreshold) || 5;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [invoicesList, productsList] = await Promise.all([syncService.getInvoices(), syncService.getProducts()]);

        const todayStr = getTodayDateStr();
        const thisMonthPrefix = todayStr.substring(0, 7);

        let todaySales = 0;
        let todayCount = 0;
        let monthSales = 0;
        let outstanding = 0;
        let dueCount = 0;

        invoicesList.forEach(inv => {
          const total = inv.grandTotal || 0;
          if (inv.date === todayStr) {
            todaySales += total;
            todayCount++;
          }
          if ((inv.date || '').startsWith(thisMonthPrefix)) {
            monthSales += total;
          }
          const due = getBalanceDue(inv);
          if (due > 0) {
            outstanding += due;
            dueCount++;
          }
        });

        setStats({
          todaySales,
          todayCount,
          monthSales,
          outstanding,
          dueCount,
          totalInvoices: invoicesList.length,
          totalProducts: productsList.length
        });

        setRecentInvoices(invoicesList.slice(0, 5));
        setLowStock(productsList.filter(p => p.stock <= threshold).sort((a, b) => a.stock - b.stock).slice(0, 6));
        setLoading(false);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [threshold]);

  if (loading) {
    return <div style={{ padding: '24px', color: 'var(--text-muted)' }}>Loading Dashboard Stats...</div>;
  }

  return (
    <div className="dashboard-layout" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="dashboard-grid">
        {/* Card 1 */}
        <div className="card metric-card">
          <div className="metric-icon icon-sales">Rs</div>
          <div className="metric-info">
            <span className="metric-title">Today's Sales</span>
            <span className="metric-value">{formatINR(stats.todaySales)}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{stats.todayCount} bill(s) today</span>
          </div>
        </div>
        {/* Card 2 */}
        <div className="card metric-card">
          <div className="metric-icon icon-month">📅</div>
          <div className="metric-info">
            <span className="metric-title">Monthly Sales</span>
            <span className="metric-value">{formatINR(stats.monthSales)}</span>
          </div>
        </div>
        {/* Card 3 */}
        <div className="card metric-card" style={{ cursor: 'pointer' }} onClick={() => setActivePage('customers')} title="View customers with dues">
          <div className="metric-icon icon-collection">💼</div>
          <div className="metric-info">
            <span className="metric-title">Outstanding Dues</span>
            <span className="metric-value" style={{ color: stats.outstanding > 0 ? 'var(--error)' : undefined }}>{formatINR(stats.outstanding)}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{stats.dueCount} unpaid invoice(s)</span>
          </div>
        </div>
        {/* Card 4 */}
        <div className="card metric-card">
          <div className="metric-icon icon-invoices">🧾</div>
          <div className="metric-info">
            <span className="metric-title">Saved Invoices</span>
            <span className="metric-value">{stats.totalInvoices}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-actions-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Quick Launch Card */}
        <div className="card quick-actions-card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700' }}>Quick Desk</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              className="btn btn-primary"
              onClick={() => setActivePage('billing')}
              style={{ padding: '14px', borderRadius: 'var(--radius-md)', fontWeight: '600' }}
            >
              🧾 Create New Invoice
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setActivePage('products')}
              style={{ padding: '14px', borderRadius: 'var(--radius-md)', fontWeight: '600' }}
            >
              🛋️ Manage Inventory
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setActivePage('records')}
              style={{ padding: '14px', borderRadius: 'var(--radius-md)', fontWeight: '600' }}
            >
              📂 View History
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setActivePage(isAdmin ? 'reports' : 'customers')}
              style={{ padding: '14px', borderRadius: 'var(--radius-md)', fontWeight: '600' }}
            >
              {isAdmin ? '📈 Reports & GST' : '👥 Customers & Dues'}
            </button>
          </div>
        </div>

        {/* System Summary Card */}
        <div className="card system-status-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' }}>
          <h3 style={{ margin: '0', fontSize: '16px', fontWeight: '700' }}>System Status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Data Storage:</span>
              <strong style={{ color: 'var(--success)' }}>● {syncService.isOnline() ? 'Cloud Sync (Supabase)' : 'This Device (IndexedDB)'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Signed in as:</span>
              <strong style={{ color: 'var(--info)' }}>{user?.name} ({isAdmin ? 'Admin' : 'Staff'})</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Available Products:</span>
              <strong>{stats.totalProducts} Items</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Proprietor Profile:</span>
              <strong>{shopConfig.proprietor || '-'}</strong>
            </div>
          </div>
          {lowStock.length > 0 && (
            <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--warning)', marginBottom: '6px' }}>⚠️ Low Stock Alerts</div>
              {lowStock.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '2px 0' }}>
                  <span>{p.name}</span>
                  <strong style={{ color: p.stock <= 0 ? 'var(--error)' : 'var(--warning)' }}>{p.stock <= 0 ? 'Out of stock' : `${p.stock} ${p.unit}`}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Invoices Card */}
      <div className="card recent-invoices-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: '0', fontSize: '16px', fontWeight: '700' }}>Recent Invoices</h3>
          <button
            className="btn btn-text"
            onClick={() => setActivePage('records')}
            style={{ fontSize: '13px', color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer', fontWeight: '600' }}
          >
            View All Invoices →
          </button>
        </div>
        <div className="billing-table-container">
          <table className="billing-table">
            <thead>
              <tr style={{ backgroundColor: 'var(--primary-light)', color: 'var(--text-main)' }}>
                <th style={{ padding: '12px 8px' }}>Invoice No.</th>
                <th>Customer Name</th>
                <th>Date</th>
                <th>Payment Mode</th>
                <th style={{ textAlign: 'right', paddingRight: '16px' }}>Grand Total</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                    No invoices created yet. Start billing to populate records!
                  </td>
                </tr>
              ) : (
                recentInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => onViewInvoice(inv)}
                    style={{ cursor: 'pointer' }}
                    className="hover-row"
                  >
                    <td style={{ padding: '12px 8px' }}><strong>{inv.invoiceNumber}</strong></td>
                    <td>{inv.customerName}</td>
                    <td>{formatDate(inv.date)}</td>
                    <td>
                      <span
                        className="shop-status-badge"
                        style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', fontSize: '10px', borderRadius: '4px' }}
                      >
                        {inv.paymentMode}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '600', paddingRight: '16px' }}>
                      {formatINR(inv.grandTotal)}
                      {getBalanceDue(inv) > 0 && <div style={{ fontSize: '10px', color: 'var(--error)' }}>Due {formatINR(getBalanceDue(inv))}</div>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
