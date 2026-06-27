import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import dbInstance from '../db/syncService';

export default function Reports() {
  const [reportType, setReportType] = useState('sales');
  const [invoices, setInvoices] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState({
    v1: '0.00', label1: 'Gross Revenue',
    v2: '0', label2: 'Total Transactions',
    v3: '0.00', label3: 'Avg. Invoice Value'
  });

  useEffect(() => {
    async function loadInvoices() {
      try {
        const list = await dbInstance.getInvoices();
        setInvoices(list);
      } catch (err) {
        console.error('Failed to load invoices:', err);
      }
    }
    loadInvoices();
  }, []);

  useEffect(() => {
    if (invoices.length === 0) {
      setReportData([]);
      return;
    }

    if (reportType === 'sales') {
      // Group invoices by date
      const dateMap = {};
      let grandRevenue = 0;

      invoices.forEach(inv => {
        const date = inv.date;
        const total = inv.grandTotal || 0;
        grandRevenue += total;

        if (!dateMap[date]) {
          dateMap[date] = { date, count: 0, revenue: 0 };
        }
        dateMap[date].count++;
        dateMap[date].revenue += total;
      });

      const list = Object.values(dateMap);
      list.sort((a, b) => b.date.localeCompare(a.date));
      setReportData(list);

      const txCount = invoices.length;
      const avg = txCount > 0 ? grandRevenue / txCount : 0;
      setSummary({
        v1: `₹${grandRevenue.toFixed(2)}`, label1: 'Gross Revenue',
        v2: String(txCount), label2: 'Total Transactions',
        v3: `₹${avg.toFixed(2)}`, label3: 'Avg. Invoice Value'
      });

    } else if (reportType === 'monthly') {
      const monthMap = {};
      let grandTotal = 0;

      invoices.forEach(inv => {
        const monthStr = inv.date.substring(0, 7); // "YYYY-MM"
        const total = inv.grandTotal || 0;
        grandTotal += total;

        if (!monthMap[monthStr]) {
          monthMap[monthStr] = { month: monthStr, count: 0, revenue: 0 };
        }
        monthMap[monthStr].count++;
        monthMap[monthStr].revenue += total;
      });

      const list = Object.values(monthMap);
      list.sort((a, b) => b.month.localeCompare(a.month));
      setReportData(list);

      const totalMonths = list.length;
      const avg = totalMonths > 0 ? grandTotal / totalMonths : 0;
      setSummary({
        v1: `₹${grandTotal.toFixed(2)}`, label1: 'Gross Sales',
        v2: String(totalMonths), label2: 'Total Months',
        v3: `₹${avg.toFixed(2)}`, label3: 'Avg Monthly Revenue'
      });

    } else if (reportType === 'customer') {
      const custMap = {};
      let grandRevenue = 0;

      invoices.forEach(inv => {
        const name = inv.customerName || 'Walk-in Customer';
        const mobile = inv.customerMobile || 'N/A';
        const key = `${name}_${mobile}`;
        const total = inv.grandTotal || 0;
        grandRevenue += total;

        if (!custMap[key]) {
          custMap[key] = { name, mobile, count: 0, revenue: 0 };
        }
        custMap[key].count++;
        custMap[key].revenue += total;
      });

      const list = Object.values(custMap);
      list.sort((a, b) => b.revenue - a.revenue);
      setReportData(list);

      const totalCustomers = list.length;
      const avg = totalCustomers > 0 ? grandRevenue / totalCustomers : 0;
      setSummary({
        v1: String(totalCustomers), label1: 'Active Customers',
        v2: `₹${grandRevenue.toFixed(2)}`, label2: 'Total Client Billing',
        v3: `₹${avg.toFixed(2)}`, label3: 'Avg. Client Spend'
      });

    } else if (reportType === 'product') {
      const prodMap = {};
      let totalQty = 0;
      let grandRevenue = 0;

      invoices.forEach(inv => {
        if (inv.items && Array.isArray(inv.items)) {
          inv.items.forEach(item => {
            const name = item.name;
            const qty = item.qty || 0;
            const revenue = item.total || 0;
            
            totalQty += qty;
            grandRevenue += revenue;

            if (!prodMap[name]) {
              prodMap[name] = { name, barcode: item.barcode || '-', qty: 0, revenue: 0, unit: item.unit || 'PCS' };
            }
            prodMap[name].qty += qty;
            prodMap[name].revenue += revenue;
          });
        }
      });

      const list = Object.values(prodMap);
      list.sort((a, b) => b.revenue - a.revenue);
      setReportData(list);

      setSummary({
        v1: String(list.length), label1: 'Unique Products Sold',
        v2: String(totalQty), label2: 'Total Quantity Sold',
        v3: `₹${grandRevenue.toFixed(2)}`, label3: 'Furniture Gross Revenue'
      });

    } else if (reportType === 'gst') {
      let totalTaxable = 0;
      let totalCgst = 0;
      let totalSgst = 0;

      const list = invoices.map(inv => {
        const taxable = inv.subtotal || 0;
        const cgst = inv.cgstTotal || 0;
        const sgst = inv.sgstTotal || 0;

        totalTaxable += taxable;
        totalCgst += cgst;
        totalSgst += sgst;

        return {
          date: inv.date,
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customerName,
          gstin: inv.customerGstin || 'N/A',
          taxable,
          cgst,
          sgst,
          totalGst: cgst + sgst,
          grandTotal: inv.grandTotal
        };
      });

      setReportData(list);
      setSummary({
        v1: `₹${totalTaxable.toFixed(2)}`, label1: 'Total Taxable Val',
        v2: `₹${totalCgst.toFixed(2)}`, label2: 'CGST Sum',
        v3: `₹${totalSgst.toFixed(2)}`, label3: 'SGST Sum'
      });
    }

  }, [reportType, invoices]);

  // --- SHEETJS EXPORT ENGINE ---
  const handleExport = () => {
    if (reportData.length === 0) {
      window.Toast.warn('Cannot export an empty report.');
      return;
    }

    try {
      let exportRows = [];
      let filename = `VFH_${reportType}_Report`;

      if (reportType === 'sales') {
        exportRows = reportData.map(r => ({
          'Sales Date': new Date(r.date).toLocaleDateString('en-GB'),
          'Invoices Count': r.count,
          'Total Sales (INR)': r.revenue.toFixed(2)
        }));
      } else if (reportType === 'monthly') {
        exportRows = reportData.map(r => {
          const [year, month] = r.month.split('-');
          const dateObj = new Date(year, month - 1);
          const monthName = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          return {
            'Month': monthName,
            'Invoices Count': r.count,
            'Total Sales (INR)': r.revenue.toFixed(2)
          };
        });
      } else if (reportType === 'customer') {
        exportRows = reportData.map(r => ({
          'Customer Name': r.name,
          'Mobile Number': r.mobile,
          'Total Invoices': r.count,
          'Total Spending (INR)': r.revenue.toFixed(2)
        }));
      } else if (reportType === 'product') {
        exportRows = reportData.map(r => ({
          'Product Name': r.name,
          'Barcode': r.barcode,
          'Quantity Sold': r.qty,
          'Revenue (INR)': r.revenue.toFixed(2)
        }));
      } else if (reportType === 'gst') {
        exportRows = reportData.map(r => ({
          'Invoice Number': r.invoiceNumber,
          'Date': new Date(r.date).toLocaleDateString('en-GB'),
          'Customer Name': r.customerName,
          'Customer GSTIN': r.gstin,
          'Taxable Amount (INR)': r.taxable.toFixed(2),
          'CGST (INR)': r.cgst.toFixed(2),
          'SGST (INR)': r.sgst.toFixed(2),
          'Total Tax (INR)': r.totalGst.toFixed(2),
          'Grand Total (INR)': r.grandTotal.toFixed(2)
        }));
      }

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report Data');
      
      XLSX.writeFile(workbook, `${filename}.xlsx`);
      window.Toast.success(`Successfully exported "${filename}.xlsx"`);

    } catch (err) {
      console.error('SheetJS Excel export crashed:', err);
      window.Toast.error('Failed to export report to Excel.');
    }
  };

  return (
    <div className="reports-layout" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Sub-navigation tabs */}
      <div className="report-subnav" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        {[
          { id: 'sales', label: '📊 Daily Sales' },
          { id: 'monthly', label: '📅 Monthly Sales' },
          { id: 'customer', label: '👥 Customer Leaderboard' },
          { id: 'product', label: '🛋️ Product Revenue' },
          { id: 'gst', label: '🏛️ GST GSTR-1 Tally' }
        ].map((tab) => (
          <button
            key={tab.id}
            className={`btn ${reportType === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setReportType(tab.id)}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary statistics cards */}
      <div className="report-summary-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div className="card metric-card" style={{ padding: '16px' }}>
          <div className="metric-info">
            <span className="metric-title">{summary.label1}</span>
            <span className="metric-value" style={{ fontSize: '20px' }}>{summary.v1}</span>
          </div>
        </div>
        <div className="card metric-card" style={{ padding: '16px' }}>
          <div className="metric-info">
            <span className="metric-title">{summary.label2}</span>
            <span className="metric-value" style={{ fontSize: '20px' }}>{summary.v2}</span>
          </div>
        </div>
        <div className="card metric-card" style={{ padding: '16px' }}>
          <div className="metric-info">
            <span className="metric-title">{summary.label3}</span>
            <span className="metric-value" style={{ fontSize: '20px' }}>{summary.v3}</span>
          </div>
        </div>
      </div>

      {/* Table grid actions */}
      <div className="table-actions-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={{ fontWeight: '700', fontSize: '14px' }}>Generated records ({reportData.length} records)</div>
        <button className="btn btn-secondary" onClick={handleExport}>📥 Export Current Report to Excel</button>
      </div>

      {/* Table grid */}
      <div className="billing-table-container">
        <table className="billing-table">
          <thead>
            {reportType === 'sales' && (
              <tr>
                <th style={{ padding: '12px 8px' }}>Date</th>
                <th style={{ textAlign: 'center' }}>Invoices Count</th>
                <th style={{ textAlign: 'right', paddingRight: '24px' }}>Total Sales (₹)</th>
              </tr>
            )}
            {reportType === 'monthly' && (
              <tr>
                <th style={{ padding: '12px 8px' }}>Month</th>
                <th style={{ textAlign: 'center' }}>Invoices Count</th>
                <th style={{ textAlign: 'right', paddingRight: '24px' }}>Total Sales (₹)</th>
              </tr>
            )}
            {reportType === 'customer' && (
              <tr>
                <th style={{ padding: '12px 8px' }}>Customer Name</th>
                <th>Mobile</th>
                <th style={{ textAlign: 'center' }}>Total Invoices</th>
                <th style={{ textAlign: 'right', paddingRight: '24px' }}>Total Purchases (₹)</th>
              </tr>
            )}
            {reportType === 'product' && (
              <tr>
                <th style={{ padding: '12px 8px' }}>Product Name</th>
                <th>Barcode</th>
                <th style={{ textAlign: 'center' }}>Quantity Sold</th>
                <th style={{ textAlign: 'right', paddingRight: '24px' }}>Revenue Generated (₹)</th>
              </tr>
            )}
            {reportType === 'gst' && (
              <tr>
                <th style={{ padding: '12px 8px' }}>Invoice Number</th>
                <th>Date</th>
                <th>Customer Name / GSTIN</th>
                <th style={{ textAlign: 'right' }}>Taxable Amt (₹)</th>
                <th style={{ textAlign: 'right' }}>CGST (₹)</th>
                <th style={{ textAlign: 'right' }}>SGST (₹)</th>
                <th style={{ textAlign: 'right' }}>Total Tax (₹)</th>
                <th style={{ textAlign: 'right', paddingRight: '24px' }}>Total (₹)</th>
              </tr>
            )}
          </thead>
          <tbody>
            {reportData.length === 0 ? (
              <tr>
                <td colSpan={reportType === 'gst' ? 8 : 4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                  No reports statistics available. Save some invoices to populate data.
                </td>
              </tr>
            ) : (
              reportData.map((row, index) => {
                if (reportType === 'sales') {
                  return (
                    <tr key={index}>
                      <td style={{ padding: '12px 8px' }}><strong>{new Date(row.date).toLocaleDateString('en-GB')}</strong></td>
                      <td style={{ textAlign: 'center' }}>{row.count}</td>
                      <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--primary)', paddingRight: '24px' }}>₹{row.revenue.toFixed(2)}</td>
                    </tr>
                  );
                } else if (reportType === 'monthly') {
                  const [year, month] = row.month.split('-');
                  const dateObj = new Date(year, month - 1);
                  const formattedMonth = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                  return (
                    <tr key={index}>
                      <td style={{ padding: '12px 8px' }}><strong>{formattedMonth}</strong></td>
                      <td style={{ textAlign: 'center' }}>{row.count}</td>
                      <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--primary)', paddingRight: '24px' }}>₹{row.revenue.toFixed(2)}</td>
                    </tr>
                  );
                } else if (reportType === 'customer') {
                  return (
                    <tr key={index}>
                      <td style={{ padding: '12px 8px', fontWeight: '600', textAlign: 'left' }}>{row.name}</td>
                      <td>{row.mobile}</td>
                      <td style={{ textAlign: 'center' }}>{row.count}</td>
                      <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--primary)', paddingRight: '24px' }}>₹{row.revenue.toFixed(2)}</td>
                    </tr>
                  );
                } else if (reportType === 'product') {
                  return (
                    <tr key={index}>
                      <td style={{ padding: '12px 8px', fontWeight: '600', textAlign: 'left' }}>{row.name}</td>
                      <td><code>{row.barcode}</code></td>
                      <td style={{ textAlign: 'center' }}>{row.qty} {row.unit}</td>
                      <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--primary)', paddingRight: '24px' }}>₹{row.revenue.toFixed(2)}</td>
                    </tr>
                  );
                } else if (reportType === 'gst') {
                  return (
                    <tr key={index}>
                      <td style={{ padding: '12px 8px' }}><strong>{row.invoiceNumber}</strong></td>
                      <td>{new Date(row.date).toLocaleDateString('en-GB')}</td>
                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: '600' }}>{row.customerName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>GSTIN: {row.gstin}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>₹{row.taxable.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>₹{row.cgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>₹{row.sgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--warning)', fontWeight: '500' }}>₹{row.totalGst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontStyle: 'normal', fontWeight: '600', color: 'var(--primary)', paddingRight: '24px' }}>₹{row.grandTotal.toFixed(2)}</td>
                    </tr>
                  );
                }
                return null;
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
