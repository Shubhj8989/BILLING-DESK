import React, { useState, useEffect, useRef } from 'react';
import dbInstance from '../db/syncService';
import AutoComplete from '../components/AutoComplete';
import { convertNumberToWords } from '../utils/numbers';

export default function Billing({ editingInvoice, onInvoiceSaved, setActivePage }) {
  const [shopConfig, setShopConfig] = useState({});
  const [productSuggestions, setProductSuggestions] = useState([]);
  
  // Metadata States
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerState, setCustomerState] = useState('Uttar Pradesh');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [salesperson, setSalesperson] = useState('');

  // Transport details
  const [deliveryNote, setDeliveryNote] = useState('');
  const [refNo, setRefNo] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [dispatchThrough, setDispatchThrough] = useState('');
  const [destination, setDestination] = useState('');
  const [termsDelivery, setTermsDelivery] = useState('');

  // Bottom calculations
  const [freight, setFreight] = useState('');
  const [freightGst, setFreightGst] = useState('18');
  const [extraDiscount, setExtraDiscount] = useState('');

  // Rows State
  const [rows, setRows] = useState([
    { id: Date.now(), barcode: '', name: '', hsn: '', qty: 1, unit: 'PCS', rate: 0, discount: 0, discountType: 'percent', gst: 18, taxableAmount: 0, cgst: 0, sgst: 0, total: 0 }
  ]);

  const [autosaveIndicator, setAutosaveIndicator] = useState(false);
  const barcodeScanInputRef = useRef(null);

  const getTodayDateStr = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localNow = new Date(now.getTime() - (offset * 60 * 1000));
    return localNow.toISOString().split('T')[0];
  };

  const getCurrentTimeStr = () => {
    const now = new Date();
    return now.toTimeString().split(' ')[0].substring(0, 5);
  };

  // --- INITIALIZE & DEFAULTS ---
  useEffect(() => {
    async function initPage() {
      try {
        const config = await dbInstance.getSettings();
        setShopConfig(config);

        const prods = await dbInstance.getProducts();
        setProductSuggestions(prods);

        if (editingInvoice) {
          // Load editing invoice details
          setInvoiceNumber(editingInvoice.invoiceNumber);
          setDate(editingInvoice.date);
          setTime(editingInvoice.time);
          setCustomerName(editingInvoice.customerName);
          setCustomerAddress(editingInvoice.customerAddress || '');
          setCustomerMobile(editingInvoice.customerMobile || '');
          setCustomerGstin(editingInvoice.customerGstin || '');
          setCustomerState(editingInvoice.customerState || 'Uttar Pradesh');
          setPaymentMode(editingInvoice.paymentMode || 'Cash');
          setSalesperson(editingInvoice.salesperson || '');

          setDeliveryNote(editingInvoice.deliveryNote || '');
          setRefNo(editingInvoice.refNo || '');
          setOrderNo(editingInvoice.orderNo || '');
          setDispatchThrough(editingInvoice.dispatchThrough || '');
          setDestination(editingInvoice.destination || '');
          setTermsDelivery(editingInvoice.termsDelivery || '');

          setFreight(editingInvoice.freight > 0 ? String(editingInvoice.freight) : '');
          setFreightGst(String(editingInvoice.freightGst || 18));
          setExtraDiscount(editingInvoice.extraDiscount > 0 ? String(editingInvoice.extraDiscount) : '');

          // Map items
          const mappedRows = editingInvoice.items.map(item => ({
            id: Math.random(),
            barcode: item.barcode || '',
            name: item.name,
            hsn: item.hsn || '',
            qty: item.qty,
            unit: item.unit || 'PCS',
            rate: item.rate,
            discount: item.discount || 0,
            discountType: item.discountType || 'percent',
            gst: item.gst || 18,
            taxableAmount: item.taxableAmount || 0,
            cgst: item.cgst || 0,
            sgst: item.sgst || 0,
            total: item.total || 0
          }));
          setRows(mappedRows);
        } else {
          // Load new invoice defaults
          setDate(getTodayDateStr());
          setTime(getCurrentTimeStr());
          setCustomerState('Uttar Pradesh');
          setPaymentMode('Cash');
          setSalesperson('');
          setFreight('');
          setFreightGst('18');
          setExtraDiscount('');
          setCustomerName('');
          setCustomerAddress('');
          setCustomerMobile('');
          setCustomerGstin('');
          
          setDeliveryNote('');
          setRefNo('');
          setOrderNo('');
          setDispatchThrough('');
          setDestination('');
          setTermsDelivery('');

          setRows([
            { id: Date.now(), barcode: '', name: '', hsn: '', qty: 1, unit: 'PCS', rate: 0, discount: 0, discountType: 'percent', gst: 18, taxableAmount: 0, cgst: 0, sgst: 0, total: 0 }
          ]);

          // Fetch next serial
          const allInvoices = await dbInstance.getInvoices();
          const prefix = config.invoicePrefix || '';
          const startNum = config.invoiceStartNumber || 1001;
          const nextNum = startNum + allInvoices.length;
          setInvoiceNumber(`${prefix}${nextNum}`);

          // Draft Recovery Check
          const draftStr = localStorage.getItem('billing_draft');
          if (draftStr) {
            try {
              const draft = JSON.parse(draftStr);
              const restore = await window.Dialog.confirm('An unsaved billing draft was found. Do you want to restore it?', 'Draft Recovery');
              if (restore) {
                setCustomerName(draft.customerName || '');
                setCustomerAddress(draft.customerAddress || '');
                setCustomerMobile(draft.customerMobile || '');
                setCustomerGstin(draft.customerGstin || '');
                setCustomerState(draft.customerState || 'Uttar Pradesh');
                setPaymentMode(draft.paymentMode || 'Cash');
                setSalesperson(draft.salesperson || '');

                setDeliveryNote(draft.deliveryNote || '');
                setRefNo(draft.refNo || '');
                setOrderNo(draft.orderNo || '');
                setDispatchThrough(draft.dispatchThrough || '');
                setDestination(draft.destination || '');
                setTermsDelivery(draft.termsDelivery || '');

                setFreight(draft.freight > 0 ? String(draft.freight) : '');
                setFreightGst(String(draft.freightGst || 18));
                setExtraDiscount(draft.extraDiscount > 0 ? String(draft.extraDiscount) : '');

                const mappedDraftRows = draft.items.map(item => ({
                  id: Math.random(),
                  barcode: item.barcode || '',
                  name: item.name,
                  hsn: item.hsn || '',
                  qty: item.qty,
                  unit: item.unit || 'PCS',
                  rate: item.rate,
                  discount: item.discount || 0,
                  discountType: item.discountType || 'percent',
                  gst: item.gst || 18,
                  taxableAmount: item.taxableAmount || 0,
                  cgst: item.cgst || 0,
                  sgst: item.sgst || 0,
                  total: item.total || 0
                }));
                setRows(mappedDraftRows);
                window.Toast.success('Draft invoice restored.');
              } else {
                localStorage.removeItem('billing_draft');
              }
            } catch (e) {
              console.warn('Draft restore parse error:', e);
            }
          }
        }
      } catch (err) {
        console.error('Failed to initialize billing desk:', err);
      }
    }
    initPage();
  }, [editingInvoice]);

  // --- DRAFT AUTOSAVE TIMER ---
  useEffect(() => {
    if (editingInvoice) return; // Don't autosave while editing history entries

    const timer = setInterval(() => {
      const payload = collectInvoiceData();
      const hasData = payload.customerName || payload.customerMobile || (payload.items.length > 0 && payload.items[0].name);
      if (hasData) {
        localStorage.setItem('billing_draft', JSON.stringify(payload));
        setAutosaveIndicator(true);
        setTimeout(() => setAutosaveIndicator(false), 800);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [customerName, customerMobile, customerAddress, customerGstin, customerState, paymentMode, salesperson, rows, freight, freightGst, extraDiscount]);

  // --- ROW CALCULATOR INTERNAL UTILITY ---
  const recalculateRowFields = (qty, rate, discount, discountType, gst) => {
    const base = qty * rate;
    const disc = discountType === 'percent' ? (base * (discount / 100)) : discount;
    const taxable = Math.max(0, base - disc);
    const gstAmt = taxable * (gst / 100);
    const split = gstAmt / 2;
    const total = taxable + gstAmt;

    return {
      taxableAmount: taxable,
      cgst: split,
      sgst: split,
      total
    };
  };

  // --- ROW HANDLERS ---
  const updateRow = (id, fields) => {
    const updated = rows.map(row => {
      if (row.id === id) {
        const merged = { ...row, ...fields };
        const calculated = recalculateRowFields(
          parseFloat(merged.qty) || 0,
          parseFloat(merged.rate) || 0,
          parseFloat(merged.discount) || 0,
          merged.discountType,
          parseFloat(merged.gst) || 0
        );
        return { ...merged, ...calculated };
      }
      return row;
    });
    setRows(updated);
  };

  const handleRowSelectProduct = (id, product) => {
    const updated = rows.map(row => {
      if (row.id === id) {
        const merged = {
          ...row,
          barcode: product.barcode || '',
          name: product.name,
          hsn: product.hsn || '',
          rate: product.rate || 0,
          unit: product.unit || 'PCS',
          discount: product.discount || 0,
          discountType: 'percent', // product master default is percentage
          gst: product.gst || 18,
          qty: 1
        };
        const calculated = recalculateRowFields(1, merged.rate, merged.discount, 'percent', merged.gst);
        return { ...merged, ...calculated };
      }
      return row;
    });
    setRows(updated);
  };

  const addNewRow = () => {
    setRows([
      ...rows,
      { id: Date.now(), barcode: '', name: '', hsn: '', qty: 1, unit: 'PCS', rate: 0, discount: 0, discountType: 'percent', gst: 18, taxableAmount: 0, cgst: 0, sgst: 0, total: 0 }
    ]);
  };

  const deleteRow = (id) => {
    if (rows.length === 1) {
      setRows([
        { id: Date.now(), barcode: '', name: '', hsn: '', qty: 1, unit: 'PCS', rate: 0, discount: 0, discountType: 'percent', gst: 18, taxableAmount: 0, cgst: 0, sgst: 0, total: 0 }
      ]);
    } else {
      setRows(rows.filter(row => row.id !== id));
    }
  };

  // --- BARCODE SCANNER INTEGRATION ---
  const handleBarcodeScan = async (e) => {
    if (e.key === 'Enter') {
      const barcode = e.target.value.trim();
      if (!barcode) return;
      e.target.value = ''; // Reset scanner input immediately

      try {
        const product = await dbInstance.getProductByBarcode(barcode);
        if (product) {
          // Check if barcode is already present in any of our rows
          const index = rows.findIndex(row => row.barcode.trim() === barcode);
          if (index !== -1) {
            // Increment quantity of existing row
            const targetRow = rows[index];
            const nextQty = targetRow.qty + 1;
            const calculated = recalculateRowFields(nextQty, targetRow.rate, targetRow.discount, targetRow.discountType, targetRow.gst);
            const updatedRows = [...rows];
            updatedRows[index] = { ...targetRow, qty: nextQty, ...calculated };
            setRows(updatedRows);
            window.Toast.success(`Incremented quantity for "${product.name}"`);
          } else {
            // Check if there is a blank row to use
            const blankIndex = rows.findIndex(row => !row.name.trim() && !row.barcode.trim() && row.rate === 0);
            const updatedRows = [...rows];
            const newRowPayload = {
              barcode: product.barcode || '',
              name: product.name,
              hsn: product.hsn || '',
              rate: product.rate || 0,
              unit: product.unit || 'PCS',
              discount: product.discount || 0,
              discountType: 'percent',
              gst: product.gst || 18,
              qty: 1
            };
            const calculated = recalculateRowFields(1, newRowPayload.rate, newRowPayload.discount, 'percent', newRowPayload.gst);
            
            if (blankIndex !== -1) {
              updatedRows[blankIndex] = { ...updatedRows[blankIndex], ...newRowPayload, ...calculated };
            } else {
              updatedRows.push({ id: Date.now(), ...newRowPayload, ...calculated });
            }
            setRows(updatedRows);
            window.Toast.success(`Added "${product.name}" via scan`);
          }
        } else {
          window.Toast.warn('No product registered with this barcode scan.');
        }
      } catch (err) {
        console.error('Barcode lookup failed:', err);
      }
    }
  };

  const handleRowBarcodeEnter = async (id, barcodeVal) => {
    if (!barcodeVal.trim()) return;
    try {
      const match = await dbInstance.getProductByBarcode(barcodeVal);
      if (match) {
        handleRowSelectProduct(id, match);
        window.Toast.success(`Imported "${match.name}"`);
      } else {
        window.Toast.warn('No product match found for this barcode.');
      }
    } catch (err) {
      console.error('Row barcode lookup failed:', err);
    }
  };

  // --- CALCULATION GRAND SUMS ---
  const calculateTotals = () => {
    let subtotalSum = 0;
    let discountSum = 0;
    let cgstSum = 0;
    let sgstSum = 0;
    let grossSum = 0;

    rows.forEach(row => {
      subtotalSum += row.taxableAmount;
      const base = (parseFloat(row.qty) || 0) * (parseFloat(row.rate) || 0);
      const disc = row.discountType === 'percent' ? (base * (row.discount / 100)) : row.discount;
      discountSum += disc;
      cgstSum += row.cgst;
      sgstSum += row.sgst;
      grossSum += row.total;
    });

    const fr = parseFloat(freight) || 0;
    const frGst = parseFloat(freightGst) || 18;
    const frTax = fr * (frGst / 100);
    const extraDisc = parseFloat(extraDiscount) || 0;

    const isLocal = customerState === 'Uttar Pradesh';
    let finalCgst = 0;
    let finalSgst = 0;
    let finalIgst = 0;

    if (isLocal) {
      finalCgst = cgstSum + (frTax / 2);
      finalSgst = sgstSum + (frTax / 2);
    } else {
      finalIgst = cgstSum + sgstSum + frTax;
    }

    const netTaxable = subtotalSum + fr;
    const netTax = isLocal ? (finalCgst + finalSgst) : finalIgst;
    const netGross = netTaxable + netTax - extraDisc;
    const grandTotal = Math.round(netGross);
    const roundOff = grandTotal - netGross;

    return {
      subtotal: subtotalSum,
      discountTotal: discountSum,
      cgstTotal: isLocal ? finalCgst : 0,
      sgstTotal: isLocal ? finalSgst : 0,
      igstTotal: isLocal ? 0 : finalIgst,
      roundOff,
      grandTotal,
      isLocal,
      amountInWords: convertNumberToWords(grandTotal)
    };
  };

  const totals = calculateTotals();

  // --- SERIALIZATION FOR SAVING ---
  const collectInvoiceData = () => {
    const items = rows
      .filter(row => row.name.trim() !== '')
      .map(row => ({
        name: row.name.trim(),
        barcode: row.barcode.trim(),
        hsn: row.hsn.trim(),
        qty: parseFloat(row.qty) || 0,
        unit: row.unit.trim(),
        rate: parseFloat(row.rate) || 0,
        discount: parseFloat(row.discount) || 0,
        discountType: row.discountType,
        gst: parseFloat(row.gst) || 0,
        taxableAmount: row.taxableAmount,
        cgst: row.cgst,
        sgst: row.sgst,
        total: row.total
      }));

    return {
      invoiceNumber,
      date,
      time,
      customerName: customerName.trim() || 'Walk-in Customer',
      customerAddress: customerAddress.trim(),
      customerMobile: customerMobile.trim(),
      customerGstin: customerGstin.trim(),
      customerState,
      paymentMode,
      salesperson: salesperson.trim(),

      deliveryNote: deliveryNote.trim(),
      refNo: refNo.trim(),
      orderNo: orderNo.trim(),
      dispatchThrough: dispatchThrough.trim(),
      destination: destination.trim(),
      termsDelivery: termsDelivery.trim(),

      freight: parseFloat(freight) || 0,
      freightGst: parseFloat(freightGst) || 18,
      extraDiscount: parseFloat(extraDiscount) || 0,

      items,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      cgstTotal: totals.cgstTotal,
      sgstTotal: totals.sgstTotal,
      igstTotal: totals.igstTotal,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      isLocal: totals.isLocal,
      amountInWords: totals.amountInWords,
      termsAndConditions: shopConfig.terms || '',
      shopConfig
    };
  };

  const handleSaveInvoice = async () => {
    const payload = collectInvoiceData();

    if (payload.items.length === 0) {
      window.Toast.error('Please enter at least one item description to save.');
      return;
    }

    try {
      if (editingInvoice) {
        payload.id = editingInvoice.id;
      }
      await dbInstance.saveInvoice(payload);
      window.Toast.success(editingInvoice ? 'Invoice updated successfully.' : 'Invoice saved successfully.');
      localStorage.removeItem('billing_draft');
      
      if (onInvoiceSaved) {
        onInvoiceSaved(payload);
      }
    } catch (err) {
      console.error('Invoice saving failed:', err);
      window.Toast.error('Failed to save invoice records to IndexedDB.');
    }
  };

  const handleClearInvoice = async () => {
    const confirm = await window.Dialog.confirm('Are you sure you want to discard all current entries and reset this invoice form?', 'Reset Desk');
    if (confirm) {
      setCustomerName('');
      setCustomerAddress('');
      setCustomerMobile('');
      setCustomerGstin('');
      setCustomerState('Uttar Pradesh');
      setPaymentMode('Cash');
      setSalesperson('');

      setDeliveryNote('');
      setRefNo('');
      setOrderNo('');
      setDispatchThrough('');
      setDestination('');
      setTermsDelivery('');

      setFreight('');
      setFreightGst('18');
      setExtraDiscount('');

      setRows([
        { id: Date.now(), barcode: '', name: '', hsn: '', qty: 1, unit: 'PCS', rate: 0, discount: 0, discountType: 'percent', gst: 18, taxableAmount: 0, cgst: 0, sgst: 0, total: 0 }
      ]);

      // Re-trigger defaults reload for number
      if (!editingInvoice) {
        const allInvoices = await dbInstance.getInvoices();
        const prefix = shopConfig.invoicePrefix || '';
        const startNum = shopConfig.invoiceStartNumber || 1001;
        const nextNum = startNum + allInvoices.length;
        setInvoiceNumber(`${prefix}${nextNum}`);
      }
      localStorage.removeItem('billing_draft');
      window.Toast.success('Form cleared.');
    }
  };

  return (
    <div className="billing-layout">
      
      {/* Quick Scanner Bar */}
      <div className="barcode-scan-bar">
        <span style={{ fontSize: '13px', fontWeight: '700' }}>⚡ Laser Barcode Scan:</span>
        <input
          type="text"
          className="form-control"
          placeholder="Scan product barcode..."
          ref={barcodeScanInputRef}
          onKeyDown={handleBarcodeScan}
          style={{ width: '220px', padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
        />
        <div className="scan-pulse-indicator"></div>
        <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '500' }}>Laser scanner listening...</span>
        
        {autosaveIndicator && (
          <div className="draft-autosave-status" style={{ marginLeft: 'auto', opacity: 1, transition: 'opacity 0.5s' }}>
            AutoSaved Draft
          </div>
        )}
      </div>

      {/* Meta Grid Form */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px' }}>👤 Customer & Invoice Parameters</h3>
        <div className="billing-meta-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Invoice Number</label>
            <input type="text" className="form-control" value={invoiceNumber} readOnly style={{ backgroundColor: 'var(--bg-app)', fontWeight: 'bold' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Invoice Date</label>
            <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Invoice Time</label>
            <input type="time" className="form-control" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Supply State (Place of Supply) *</label>
            <select className="form-control" value={customerState} onChange={(e) => setCustomerState(e.target.value)} style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-input)' }}>
              <option value="Uttar Pradesh">Uttar Pradesh (Local CGST/SGST)</option>
              <option value="Madhya Pradesh">Madhya Pradesh (Interstate IGST)</option>
              <option value="Delhi">Delhi (IGST)</option>
              <option value="Haryana">Haryana (IGST)</option>
              <option value="Rajasthan">Rajasthan (IGST)</option>
            </select>
          </div>
        </div>

        <div className="billing-meta-grid" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Customer Mobile (Optional)</label>
            <input type="text" className="form-control" placeholder="10-digit number" value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Customer Name *</label>
            <input type="text" className="form-control" placeholder="Walk-in Customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Customer Address (Street/City)</label>
            <input type="text" className="form-control" placeholder="Madawara - 284404" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>GSTIN</label>
              <input type="text" className="form-control" placeholder="15-char ID" value={customerGstin} onChange={(e) => setCustomerGstin(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Pay Mode</label>
              <select className="form-control" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-input)' }}>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI / Scan</option>
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Settlement</option>
                <option value="Credit">Credit / Book</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transport Toggle Section */}
        <details style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '11.5px', fontWeight: '600', color: 'var(--primary)' }}>🚛 Optional Transport / Dispatch Particulars</summary>
          <div className="billing-meta-grid" style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-light)' }}>Delivery Note</label>
              <input type="text" className="form-control" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-light)' }}>Supplier's Ref / Invoice Ref</label>
              <input type="text" className="form-control" value={refNo} onChange={(e) => setRefNo(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-light)' }}>Buyer's Order Number</label>
              <input type="text" className="form-control" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-light)' }}>Dispatched Through (Courier/Transporter)</label>
              <input type="text" className="form-control" value={dispatchThrough} onChange={(e) => setDispatchThrough(e.target.value)} />
            </div>
          </div>
          <div className="billing-meta-grid" style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-light)' }}>Destination</label>
              <input type="text" className="form-control" value={destination} onChange={(e) => setDestination(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-light)' }}>Terms of Delivery</label>
              <input type="text" className="form-control" value={termsDelivery} onChange={(e) => setTermsDelivery(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-light)' }}>Salesperson Name</label>
              <input type="text" className="form-control" value={salesperson} onChange={(e) => setSalesperson(e.target.value)} />
            </div>
          </div>
        </details>
      </div>

      {/* Billing Items Grid */}
      <div className="billing-table-container">
        <table className="billing-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th className="col-actions">Act</th>
              <th className="col-barcode">Barcode</th>
              <th className="col-product">Description of Goods *</th>
              <th className="col-hsn">HSN</th>
              <th className="col-qty">Qty *</th>
              <th className="col-unit">Unit</th>
              <th className="col-rate">Rate (Rs.) *</th>
              <th className="col-discount">Discount</th>
              <th className="col-gst">GST %</th>
              <th className="col-taxable">Taxable (Rs.)</th>
              <th className="col-total">Total (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="billing-row">
                <td className="col-actions" style={{ verticalAlign: 'middle' }}>
                  <button type="button" className="btn-delete-row" onClick={() => deleteRow(row.id)}>🗑️</button>
                </td>
                <td className="col-barcode">
                  <input
                    type="text"
                    className="row-barcode"
                    value={row.barcode}
                    onChange={(e) => updateRow(row.id, { barcode: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRowBarcodeEnter(row.id, e.target.value);
                    }}
                    placeholder="Barcode"
                  />
                </td>
                <td className="col-product">
                  <AutoComplete
                    value={row.name}
                    suggestions={productSuggestions}
                    onChange={(val) => updateRow(row.id, { name: val })}
                    onSelect={(prod) => handleRowSelectProduct(row.id, prod)}
                    placeholder="Fuzzy search products..."
                    className="row-name"
                  />
                </td>
                <td className="col-hsn">
                  <input type="text" className="row-hsn" value={row.hsn} onChange={(e) => updateRow(row.id, { hsn: e.target.value })} placeholder="HSN" />
                </td>
                <td className="col-qty">
                  <input type="number" className="row-qty" value={row.qty} onChange={(e) => updateRow(row.id, { qty: parseFloat(e.target.value) || 0 })} placeholder="1" min="0" step="any" />
                </td>
                <td className="col-unit">
                  <input type="text" className="row-unit" value={row.unit} onChange={(e) => updateRow(row.id, { unit: e.target.value })} placeholder="PCS" />
                </td>
                <td className="col-rate">
                  <input type="number" className="row-rate" value={row.rate || ''} onChange={(e) => updateRow(row.id, { rate: parseFloat(e.target.value) || 0 })} placeholder="0.00" min="0" step="any" />
                </td>
                <td className="col-discount" style={{ display: 'flex', gap: '2px', alignItems: 'center', justifyContent: 'center', height: '100%', border: 'none', padding: '6px 4px' }}>
                  <input
                    type="number"
                    className="row-discount"
                    value={row.discount || ''}
                    onChange={(e) => updateRow(row.id, { discount: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    min="0"
                    step="any"
                    style={{ width: '52px', textAlign: 'right' }}
                  />
                  <select
                    className="row-discount-type"
                    value={row.discountType}
                    onChange={(e) => updateRow(row.id, { discountType: e.target.value })}
                    style={{ width: '40px', height: '28px', padding: '2px', fontSize: '11px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }}
                  >
                    <option value="percent">%</option>
                    <option value="amount">Rs.</option>
                  </select>
                </td>
                <td className="col-gst">
                  <input type="number" className="row-gst" value={row.gst} onChange={(e) => updateRow(row.id, { gst: parseFloat(e.target.value) || 0 })} placeholder="18" min="0" max="100" />
                </td>
                <td className="col-taxable">
                  <input type="text" className="row-taxable-amt" value={row.taxableAmount.toFixed(2)} readOnly style={{ backgroundColor: 'var(--bg-app)' }} />
                </td>
                <td className="col-total">
                  <input type="text" className="row-total-amt" value={row.total.toFixed(2)} readOnly style={{ backgroundColor: 'var(--bg-app)', fontWeight: 'bold' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '12px' }}>
        <button type="button" className="btn btn-secondary" onClick={addNewRow}>➕ Add Row item</button>
      </div>

      {/* Bottom Layout footer */}
      <div className="billing-footer" style={{ marginTop: '24px' }}>
        {/* Comments/Freight card */}
        <div className="card billing-comments-card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '700' }}>🚚 Additional Charges / Freight Out</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Freight Charges (Rs.)</label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g. 500"
                value={freight}
                onChange={(e) => setFreight(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Freight GST %</label>
              <select
                className="form-control"
                value={freightGst}
                onChange={(e) => setFreightGst(e.target.value)}
                style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-input)' }}
              >
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
          </div>

          <h3 style={{ margin: '16px 0 12px 0', fontSize: '13px', fontWeight: '700', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>🎁 Extra Invoice-Level Cash Discount</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Less: Extra Cash Discount Amount (Rs.)</label>
            <input
              type="number"
              className="form-control"
              placeholder="e.g. 2000"
              value={extraDiscount}
              onChange={(e) => setExtraDiscount(e.target.value)}
              style={{ maxWidth: '250px' }}
            />
          </div>
        </div>

        {/* Totals display Card */}
        <div className="card totals-card">
          <div className="total-row">
            <span>Subtotal (Taxable Value):</span>
            <span style={{ fontWeight: '500' }}>Rs. {totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="total-row">
            <span>Item Discounts Total:</span>
            <span style={{ color: 'var(--error)', fontWeight: '500' }}>-Rs. {totals.discountTotal.toFixed(2)}</span>
          </div>
          {totals.isLocal ? (
            <>
              <div className="total-row">
                <span>Central Tax (CGST):</span>
                <span>Rs. {totals.cgstTotal.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span>State Tax (SGST):</span>
                <span>Rs. {totals.sgstTotal.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <div className="total-row">
              <span>Integrated Tax (IGST):</span>
              <span>Rs. {totals.igstTotal.toFixed(2)}</span>
            </div>
          )}
          <div className="total-row">
            <span>Round Off:</span>
            <span>{totals.roundOff >= 0 ? '+' : ''}Rs. {totals.roundOff.toFixed(2)}</span>
          </div>

          <div className="total-row grand-total">
            <span>Grand Total:</span>
            <span className="val-amount">Rs. {totals.grandTotal.toFixed(2)}</span>
          </div>

          <div className="words-panel" style={{ marginTop: '12px' }}>
            <span>Amount Chargeable (in words)</span>
            {totals.amountInWords}
          </div>

          {/* Action buttons */}
          <div className="billing-action-buttons">
            <button className="btn btn-secondary" type="button" onClick={handleClearInvoice}>🗑️ Reset Desk</button>
            <button className="btn btn-primary" type="button" onClick={handleSaveInvoice}>
              💾 {editingInvoice ? 'Update & Save Invoice' : 'Save & Print Invoice'}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
