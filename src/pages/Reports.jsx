import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import dbInstance from '../db/syncService';
import { getAmountPaid, getBalanceDue, formatDate, getTodayDateStr } from '../utils/invoice';

export default function Reports() {
  const [reportType, setReportType] = useState('sales');
  const [allInvoices, setAllInvoices] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const invoices = allInvoices.filter(inv => (!fromDate || inv.date >= fromDate) && (!toDate || inv.date <= toDate));
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
        setAllInvoices(list);
      } catch (err) {
        console.error('Failed to load invoices:', err);
      }
    }
    loadInvoices();
  }, []);

  useEffect(() => {
    if (invoices.length === 0) {
      setReportData([]);
      setSummary(prev => ({ ...prev, v1: '-', v2: '-', v3: '-' }));
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
        v1: `Rs. ${grandRevenue.toFixed(2)}`, label1: 'Gross Revenue',
        v2: String(txCount), label2: 'Total Transactions',
        v3: `Rs. ${avg.toFixed(2)}`, label3: 'Avg. Invoice Value'
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
        v1: `Rs. ${grandTotal.toFixed(2)}`, label1: 'Gross Sales',
        v2: String(totalMonths), label2: 'Total Months',
        v3: `Rs. ${avg.toFixed(2)}`, label3: 'Avg Monthly Revenue'
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
        v2: `Rs. ${grandRevenue.toFixed(2)}`, label2: 'Total Client Billing',
        v3: `Rs. ${avg.toFixed(2)}`, label3: 'Avg. Client Spend'
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
        v3: `Rs. ${grandRevenue.toFixed(2)}`, label3: 'Furniture Gross Revenue'
      });

    } else if (reportType === 'gst') {
      let totalTaxable = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;

      const list = invoices.map(inv => {
        // freight is part of the taxable value
        const taxable = (inv.subtotal || 0) + (inv.freight || 0);
        const cgst = inv.cgstTotal || 0;
        const sgst = inv.sgstTotal || 0;
        const igst = inv.igstTotal || 0;

        totalTaxable += taxable;
        totalCgst += cgst;
        totalSgst += sgst;
        totalIgst += igst;

        return {
          date: inv.date,
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customerName,
          gstin: inv.customerGstin || 'N/A',
          state: inv.customerState || '',
          type: inv.customerGstin ? 'B2B' : 'B2C',
          taxable,
          cgst,
          sgst,
          igst,
          totalGst: cgst + sgst + igst,
          grandTotal: inv.grandTotal
        };
      });

      setReportData(list);
      setSummary({
        v1: `Rs. ${totalTaxable.toFixed(2)}`, label1: 'Total Taxable Value',
        v2: `Rs. ${(totalCgst + totalSgst).toFixed(2)}`, label2: `CGST + SGST (${totalCgst.toFixed(2)} + ${totalSgst.toFixed(2)})`,
        v3: `Rs. ${totalIgst.toFixed(2)}`, label3: 'IGST (Interstate)'
      });

    } else if (reportType === 'hsn') {
      const hsnMap = {};
      invoices.forEach(inv => {
        const lines = [...(inv.items || [])];
        if (inv.freight > 0) {
          const fRate = inv.freightGst ?? 18;
          const fTax = inv.freight * fRate / 100;
          lines.push({ hsn: '996511', name: 'Freight', unit: 'OTH', qty: 1, gst: fRate, taxableAmount: inv.freight, cgst: fTax / 2, sgst: fTax / 2 });
        }
        lines.forEach(item => {
          const key = `${item.hsn || 'NA'}_${item.gst}`;
          if (!hsnMap[key]) {
            hsnMap[key] = { hsn: item.hsn || 'NA', description: item.name, unit: item.unit || 'PCS', rate: item.gst, qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
          }
          const row = hsnMap[key];
          const tax = (item.cgst || 0) + (item.sgst || 0);
          row.qty += Number(item.qty) || 0;
          row.taxable += item.taxableAmount || 0;
          if (inv.isLocal === false) {
            row.igst += tax;
          } else {
            row.cgst += tax / 2;
            row.sgst += tax / 2;
          }
        });
      });
      const list = Object.values(hsnMap).sort((a, b) => b.taxable - a.taxable);
      setReportData(list);
      const taxable = list.reduce((sum, r) => sum + r.taxable, 0);
      const tax = list.reduce((sum, r) => sum + r.cgst + r.sgst + r.igst, 0);
      setSummary({
        v1: String(list.length), label1: 'HSN / Rate Lines',
        v2: `Rs. ${taxable.toFixed(2)}`, label2: 'Taxable Value',
        v3: `Rs. ${tax.toFixed(2)}`, label3: 'Total Tax'
      });

    } else if (reportType === 'payment') {
      const modeMap = {};
      let collected = 0;
      let due = 0;
      invoices.forEach(inv => {
        const mode = inv.paymentMode || 'Cash';
        if (!modeMap[mode]) modeMap[mode] = { mode, count: 0, billed: 0, collected: 0, due: 0 };
        const row = modeMap[mode];
        row.count++;
        row.billed += inv.grandTotal || 0;
        row.collected += getAmountPaid(inv);
        row.due += getBalanceDue(inv);
        collected += getAmountPaid(inv);
        due += getBalanceDue(inv);
      });
      const list = Object.values(modeMap).sort((a, b) => b.billed - a.billed);
      setReportData(list);
      setSummary({
        v1: `Rs. ${(collected + due).toFixed(2)}`, label1: 'Total Billed',
        v2: `Rs. ${collected.toFixed(2)}`, label2: 'Collected',
        v3: `Rs. ${due.toFixed(2)}`, label3: 'Outstanding Dues'
      });
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, allInvoices, fromDate, toDate]);

  // --- SHEETJS EXPORT ENGINE ---
  const handleExport = () => {
    if (reportData.length === 0) {
      window.Toast.warn('Cannot export an empty report.');
      return;
    }

    try {
      let exportRows = [];
      const range = fromDate || toDate ? `_${fromDate || 'start'}_to_${toDate || getTodayDateStr()}` : '';
      let filename = `${reportType}_Report${range}`;

      if (reportType === 'sales') {
        exportRows = reportData.map(r => ({
          'Sales Date': formatDate(r.date),
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
          'Date': formatDate(r.date),
          'Customer Name': r.customerName,
          'Customer GSTIN': r.gstin,
          'Type': r.type,
          'Place of Supply': r.state,
          'Taxable Amount (INR)': Number(r.taxable.toFixed(2)),
          'CGST (INR)': Number(r.cgst.toFixed(2)),
          'SGST (INR)': Number(r.sgst.toFixed(2)),
          'IGST (INR)': Number(r.igst.toFixed(2)),
          'Total Tax (INR)': Number(r.totalGst.toFixed(2)),
          'Grand Total (INR)': Number(r.grandTotal.toFixed(2))
        }));
      } else if (reportType === 'hsn') {
        exportRows = reportData.map(r => ({
          'HSN/SAC': r.hsn,
          'Description': r.description,
          'UQC': r.unit,
          'Total Quantity': r.qty,
          'Rate (%)': r.rate,
          'Taxable Value (INR)': Number(r.taxable.toFixed(2)),
          'IGST (INR)': Number(r.igst.toFixed(2)),
          'CGST (INR)': Number(r.cgst.toFixed(2)),
          'SGST (INR)': Number(r.sgst.toFixed(2))
        }));
      } else if (reportType === 'payment') {
        exportRows = reportData.map(r => ({
          'Payment Mode': r.mode,
          'Invoices': r.count,
          'Billed (INR)': Number(r.billed.toFixed(2)),
          'Collected (INR)': Number(r.collected.toFixed(2)),
          'Outstanding (INR)': Number(r.due.toFixed(2))
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
      <div className="report-subnav" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap' }}>
        {[
          { id: 'sales', label: '📊 Daily Sales' },
          { id: 'monthly', label: '📅 Monthly Sales' },
          { id: 'customer', label: '👥 Customer Leaderboard' },
          { id: 'product', label: '🛋️ Product Revenue' },
          { id: 'gst', label: '🏛️ GST Invoice Register' },
          { id: 'hsn', label: '🧮 HSN Summary' },
          { id: 'payment', label: '💳 Payment Modes' }
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
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '14px' }}>{reportData.length} records</strong>
          <label className="filter-label">From
            <input type="date" className="form-control" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className="filter-label">To
            <input type="date" className="form-control" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
          {(fromDate || toDate) && <button className="btn btn-secondary btn-sm" onClick={() => { setFromDate(''); setToDate(''); }}>All dates</button>}
        </div>
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
                <th style={{ textAlign: 'right', paddingRight: '24px' }}>Total Sales (Rs.)</th>
              </tr>
            )}
            {reportType === 'monthly' && (
              <tr>
                <th style={{ padding: '12px 8px' }}>Month</th>
                <th style={{ textAlign: 'center' }}>Invoices Count</th>
                <th style={{ textAlign: 'right', paddingRight: '24px' }}>Total Sales (Rs.)</th>
              </tr>
            )}
            {reportType === 'customer' && (
              <tr>
                <th style={{ padding: '12px 8px' }}>Customer Name</th>
                <th>Mobile</th>
                <th style={{ textAlign: 'center' }}>Total Invoices</th>
                <th style={{ textAlign: 'right', paddingRight: '24px' }}>Total Purchases (Rs.)</th>
              </tr>
            )}
            {reportType === 'product' && (
              <tr>
                <th style={{ padding: '12px 8px' }}>Product Name</th>
                <th>Barcode</th>
                <th style={{ textAlign: 'center' }}>Quantity Sold</th>
                <th style={{ textAlign: 'right', paddingRight: '24px' }}>Revenue Generated (Rs.)</th>
              </tr>
            )}
            {reportType === 'gst' && (
              <tr>
                <th style={{ padding: '12px 8px' }}>Invoice Number</th>
                <th>Date</th>
                <th>Customer Name / GSTIN</th>
                <th style={{ textAlign: 'right' }}>Taxable Amt (Rs.)</th>
                <th style={{ textAlign: 'right' }}>CGST (Rs.)</th>
                <th style={{ textAlign: 'right' }}>SGST (Rs.)</th>
                <th style={{ textAlign: 'right' }}>IGST (Rs.)</th>
                <th style={{ textAlign: 'right' }}>Total Tax (Rs.)</th>
                <th style={{ textAlign: 'right', paddingRight: '24px' }}>Total (Rs.)</th>
              </tr>
            )}
            {reportType === 'hsn' && (
              <tr>
                <th style={{ padding: '12px 8px' }}>HSN/SAC</th>
                <th>Description</th>
                <th style={{ textAlign: 'center' }}>Qty</th>
                <th style={{ textAlign: 'center' }}>Rate</th>
                <th style={{ textAlign: 'right' }}>Taxable (Rs.)</th>
                <th style={{ textAlign: 'right' }}>CGST</th>
                <th style={{ textAlign: 'right' }}>SGST</th>
                <th style={{ textAlign: 'right', paddingRight: '24px' }}>IGST</th>
              </tr>
            )}
            {reportType === 'payment' && (
              <tr>
                <th style={{ padding: '12px 8px' }}>Payment Mode</th>
                <th style={{ textAlign: 'center' }}>Invoices</th>
                <th style={{ textAlign: 'right' }}>Billed (Rs.)</th>
                <th style={{ textAlign: 'right' }}>Collected (Rs.)</th>
                <th style={{ textAlign: 'right', paddingRight: '24px' }}>Outstanding (Rs.)</th>
              </tr>
            )}
          </thead>
          <tbody>
            {reportData.length === 0 ? (
              <tr>
                <td colSpan={reportType === 'gst' ? 9 : reportType === 'hsn' ? 8 : 5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                  No reports statistics available. Save some invoices to populate data.
                </td>
              </tr>
            ) : (
              reportData.map((row, index) => {
                if (reportType === 'sales') {
                  return (
                    <tr key={index}>
                      <td style={{ padding: '12px 8px' }}><strong>{formatDate(row.date)}</strong></td>
                      <td style={{ textAlign: 'center' }}>{row.count}</td>
                      <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--primary)', paddingRight: '24px' }}>Rs. {row.revenue.toFixed(2)}</td>
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
                      <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--primary)', paddingRight: '24px' }}>Rs. {row.revenue.toFixed(2)}</td>
                    </tr>
                  );
                } else if (reportType === 'customer') {
                  return (
                    <tr key={index}>
                      <td style={{ padding: '12px 8px', fontWeight: '600', textAlign: 'left' }}>{row.name}</td>
                      <td>{row.mobile}</td>
                      <td style={{ textAlign: 'center' }}>{row.count}</td>
                      <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--primary)', paddingRight: '24px' }}>Rs. {row.revenue.toFixed(2)}</td>
                    </tr>
                  );
                } else if (reportType === 'product') {
                  return (
                    <tr key={index}>
                      <td style={{ padding: '12px 8px', fontWeight: '600', textAlign: 'left' }}>{row.name}</td>
                      <td><code>{row.barcode}</code></td>
                      <td style={{ textAlign: 'center' }}>{row.qty} {row.unit}</td>
                      <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--primary)', paddingRight: '24px' }}>Rs. {row.revenue.toFixed(2)}</td>
                    </tr>
                  );
                } else if (reportType === 'gst') {
                  return (
                    <tr key={index}>
                      <td style={{ padding: '12px 8px' }}><strong>{row.invoiceNumber}</strong></td>
                      <td>{formatDate(row.date)}</td>
                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: '600' }}>{row.customerName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>GSTIN: {row.gstin}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>Rs. {row.taxable.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>Rs. {row.cgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>Rs. {row.sgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>Rs. {row.igst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--warning)', fontWeight: '500' }}>Rs. {row.totalGst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontStyle: 'normal', fontWeight: '600', color: 'var(--primary)', paddingRight: '24px' }}>Rs. {row.grandTotal.toFixed(2)}</td>
                    </tr>
                  );
                } else if (reportType === 'hsn') {
                  return (
                    <tr key={index}>
                      <td style={{ padding: '12px 8px' }}><strong>{row.hsn}</strong></td>
                      <td style={{ textAlign: 'left' }}>{row.description}</td>
                      <td style={{ textAlign: 'center' }}>{row.qty} {row.unit}</td>
                      <td style={{ textAlign: 'center' }}>{row.rate}%</td>
                      <td style={{ textAlign: 'right' }}>{row.taxable.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{row.cgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{row.sgst.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', paddingRight: '24px' }}>{row.igst.toFixed(2)}</td>
                    </tr>
                  );
                } else if (reportType === 'payment') {
                  return (
                    <tr key={index}>
                      <td style={{ padding: '12px 8px', fontWeight: 600 }}>{row.mode}</td>
                      <td style={{ textAlign: 'center' }}>{row.count}</td>
                      <td style={{ textAlign: 'right' }}>Rs. {row.billed.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--success)' }}>Rs. {row.collected.toFixed(2)}</td>
                      <td style={{ textAlign: 'right', paddingRight: '24px', color: row.due > 0 ? 'var(--error)' : undefined }}>Rs. {row.due.toFixed(2)}</td>
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
