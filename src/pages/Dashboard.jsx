import React, { useState, useEffect } from 'react';
import dbInstance from '../db/syncService';

export default function Dashboard({ onViewInvoice, setActivePage }) {
  const [stats, setStats] = useState({
    todaySales: 0,
    monthSales: 0,
    totalCollection: 0,
    totalInvoices: 0,
    totalProducts: 0
  });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const invoicesList = await dbInstance.getInvoices();
        const productsList = await dbInstance.getProducts();

        const now = new Date();
        // Adjust for local time zone YYYY-MM-DD
        const offset = now.getTimezoneOffset();
        const localNow = new Date(now.getTime() - (offset * 60 * 1000));
        const todayStr = localNow.toISOString().split('T')[0];
        const thisMonthPrefix = todayStr.substring(0, 7);

        let todaySales = 0;
        let monthSales = 0;
        let totalCollection = 0;

        invoicesList.forEach(inv => {
          const total = inv.grandTotal || 0;
          totalCollection += total;

          if (inv.date === todayStr) {
            todaySales += total;
          }

          if (inv.date.startsWith(thisMonthPrefix)) {
            monthSales += total;
          }
        });

        setStats({
          todaySales,
          monthSales,
          totalCollection,
          totalInvoices: invoicesList.length,
          totalProducts: productsList.length
        });

        setRecentInvoices(invoicesList.slice(0, 5));
        setLoading(false);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

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
            <span className="metric-value">Rs. {stats.todaySales.toFixed(2)}</span>
          </div>
        </div>
        {/* Card 2 */}
        <div className="card metric-card">
          <div className="metric-icon icon-month">📅</div>
          <div className="metric-info">
            <span className="metric-title">Monthly Sales</span>
            <span className="metric-value">Rs. {stats.monthSales.toFixed(2)}</span>
          </div>
        </div>
        {/* Card 3 */}
        <div className="card metric-card">
          <div className="metric-icon icon-collection">💼</div>
          <div className="metric-info">
            <span className="metric-title">Total Collection</span>
            <span className="metric-value">Rs. {stats.totalCollection.toFixed(2)}</span>
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
              onClick={() => setActivePage('reports')}
              style={{ padding: '14px', borderRadius: 'var(--radius-md)', fontWeight: '600' }}
            >
              📈 Export Analytics
            </button>
          </div>
        </div>

        {/* System Summary Card */}
        <div className="card system-status-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' }}>
          <h3 style={{ margin: '0', fontSize: '16px', fontWeight: '700' }}>System Status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Database Connection:</span>
              <strong style={{ color: 'var(--success)' }}>● Connected (IndexedDB)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Offline Engine Status:</span>
              <strong style={{ color: 'var(--info)' }}>Active & Ready</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Available Products:</span>
              <strong>{stats.totalProducts} Items</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Proprietor Profile:</span>
              <strong>SHIVAM JAIN</strong>
            </div>
          </div>
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
                    <td>{new Date(inv.date).toLocaleDateString('en-GB')}</td>
                    <td>
                      <span 
                        className="shop-status-badge" 
                        style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', fontSize: '10px', borderRadius: '4px' }}
                      >
                        {inv.paymentMode}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '600', paddingRight: '16px' }}>
                      Rs. {inv.grandTotal.toFixed(2)}
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
