import React, { useState, useEffect } from 'react';
import dbInstance from '../db/syncService';
import printModule from '../utils/print';

export default function Records({ activeInvoice, setActiveInvoice, onEditInvoice, setActivePage }) {
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [search, setSearch] = useState('');

  const loadInvoices = async () => {
    try {
      const list = await dbInstance.getInvoices();
      setInvoices(list);
      setFilteredInvoices(list);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [activeInvoice]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredInvoices(invoices);
      return;
    }
    const q = search.toLowerCase();
    const matches = invoices.filter(inv =>
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      (inv.customerMobile && inv.customerMobile.includes(q))
    );
    setFilteredInvoices(matches);
  }, [search, invoices]);

  const handleDeleteInvoice = async (invoice) => {
    const confirm = await window.Dialog.confirm(`Warning: Are you sure you want to permanently delete Invoice ${invoice.invoiceNumber}?`, 'Delete Saved Invoice', 'btn-danger');
    if (confirm) {
      try {
        await dbInstance.deleteInvoice(invoice.id);
        window.Toast.success('Invoice deleted successfully.');
        setActiveInvoice(null);
        loadInvoices();
      } catch (err) {
        console.error('Deletion failed:', err);
        window.Toast.error('Failed to delete invoice.');
      }
    }
  };

  return (
    <div className="records-layout">
      {/* Search Header Bar */}
      <div className="table-actions-row" style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px', padding: '12px 24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={{ fontWeight: '700', fontSize: '14px', whiteSpace: 'nowrap' }}>Search Invoices:</div>
        <input
          type="text"
          className="form-control"
          placeholder="Filter by customer name, mobile, or invoice serial..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '400px', textAlign: 'left', padding: '8px 12px' }}
        />
        <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
          Showing {filteredInvoices.length} of {invoices.length} Invoices
        </div>
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
              <th>State Supply</th>
              <th>Payment Mode</th>
              <th style={{ textAlign: 'right', paddingRight: '20px' }}>Grand Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
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
                  <td>{new Date(inv.date).toLocaleDateString('en-GB')} {inv.time}</td>
                  <td style={{ textAlign: 'left', fontWeight: '600' }}>{inv.customerName}</td>
                  <td>{inv.customerMobile || '-'}</td>
                  <td>{inv.customerState}</td>
                  <td>
                    <span
                      className="shop-status-badge"
                      style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', fontSize: '10px', borderRadius: '4px' }}
                    >
                      {inv.paymentMode}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '700', paddingRight: '20px' }}>
                    ₹{inv.grandTotal.toFixed(2)}
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" onClick={() => printModule.printInvoice(activeInvoice)}>🖨️ Print Invoice</button>
                <button className="btn btn-secondary" onClick={() => printModule.saveInvoiceAsPDF(activeInvoice)}>📥 Download PDF</button>
                <button className="btn btn-secondary" onClick={() => onEditInvoice(activeInvoice)}>✏️ Edit Invoice</button>
                <button className="btn btn-danger" onClick={() => handleDeleteInvoice(activeInvoice)} style={{ backgroundColor: 'var(--error)', border: 'none', color: '#fff' }}>🗑️ Delete</button>
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
                        <tr>
                          <td style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000', padding: '4px', width: '50%' }}>
                            <span style={{ fontSize: '8px', color: '#555', display: 'block' }}>Invoice No.</span>
                            <strong>{activeInvoice.invoiceNumber}</strong>
                          </td>
                          <td style={{ borderBottom: '1px solid #000', padding: '4px' }}>
                            <span style={{ fontSize: '8px', color: '#555', display: 'block' }}>Dated</span>
                            <strong>{new Date(activeInvoice.date).toLocaleDateString('en-GB')}</strong>
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
                          {item.discount > 0 ? (item.discountType === 'amount' ? '₹' + item.discount : item.discount + '%') : ''}
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
                      <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>₹{activeInvoice.grandTotal.toFixed(2)}</td>
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

                {/* Bank / Declaration */}
                <table style={{ width: '100%', border: '1.5px solid #000', borderTop: 'none', borderCollapse: 'collapse', marginTop: '0' }}>
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
                </table>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
