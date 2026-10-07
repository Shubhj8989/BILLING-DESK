import React, { useState, useEffect, useRef } from 'react';
import syncService from '../db/syncService';
import AutoComplete from '../components/AutoComplete';
import { convertNumberToWords } from '../utils/numbers';
import { INDIAN_STATES, DEFAULT_STATE } from '../utils/states';
import { getAmountPaid, getTodayDateStr } from '../utils/invoice';

let rowIdCounter = 0;
const createEmptyRow = () => ({
  id: `row-${Date.now()}-${rowIdCounter++}`,
  barcode: '', name: '', hsn: '', qty: 1, unit: 'PCS', rate: 0, discount: 0, discountType: 'percent', gst: 18, taxableAmount: 0, cgst: 0, sgst: 0, total: 0
});

const toNumber = (value, fallback = 0) => {
  const n = parseFloat(value);
  return Number.isNaN(n) ? fallback : n;
};

const getCurrentTimeStr = () => new Date().toTimeString().split(' ')[0].substring(0, 5);

// --- ROW CALCULATOR ---
const recalculateRowFields = (qty, rate, discount, discountType, gst) => {
  const base = qty * rate;
  const disc = discountType === 'percent' ? (base * (discount / 100)) : discount;
  const taxable = Math.max(0, base - disc);
  const gstAmt = taxable * (gst / 100);
  const split = gstAmt / 2;
  return {
    taxableAmount: taxable,
    cgst: split,
    sgst: split,
    total: taxable + gstAmt
  };
};

const mapItemsToRows = (items = []) => {
  const mapped = items.map(item => ({
    ...createEmptyRow(),
    barcode: item.barcode || '',
    name: item.name,
    hsn: item.hsn || '',
    qty: item.qty,
    unit: item.unit || 'PCS',
    rate: item.rate,
    discount: item.discount || 0,
    discountType: item.discountType || 'percent',
    gst: item.gst ?? 18,
    taxableAmount: item.taxableAmount || 0,
    cgst: item.cgst || 0,
    sgst: item.sgst || 0,
    total: item.total || 0
  }));
  return mapped.length ? mapped : [createEmptyRow()];
};

export default function Billing({ editingInvoice, prefill, onPrefillConsumed, onInvoiceSaved, user }) {
  const [shopConfig, setShopConfig] = useState({});
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [pastInvoices, setPastInvoices] = useState([]);
  const [saving, setSaving] = useState(false);

  // Metadata States
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerState, setCustomerState] = useState(DEFAULT_STATE);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [salesperson, setSalesperson] = useState('');
  const [notes, setNotes] = useState('');

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
  // Empty string = "full amount received" (or nothing, for Credit)
  const [amountReceived, setAmountReceived] = useState('');

  const [rows, setRows] = useState([createEmptyRow()]);

  const [autosaveIndicator, setAutosaveIndicator] = useState(false);
  const barcodeScanInputRef = useRef(null);
  const latestPayloadRef = useRef(null);
  const saveRef = useRef(null);

  const shopState = shopConfig.state || DEFAULT_STATE;

  const applyCustomerAndMeta = (src) => {
    setCustomerName(src.customerName === 'Walk-in Customer' ? '' : (src.customerName || ''));
    setCustomerAddress(src.customerAddress || '');
    setCustomerMobile(src.customerMobile || '');
    setCustomerGstin(src.customerGstin || '');
    setCustomerState(src.customerState || shopState);
    setPaymentMode(src.paymentMode || 'Cash');
    setSalesperson(src.salesperson || '');
    setNotes(src.notes || '');

    setDeliveryNote(src.deliveryNote || '');
    setRefNo(src.refNo || '');
    setOrderNo(src.orderNo || '');
    setDispatchThrough(src.dispatchThrough || '');
    setDestination(src.destination || '');
    setTermsDelivery(src.termsDelivery || '');

    setFreight(src.freight > 0 ? String(src.freight) : '');
    setFreightGst(String(src.freightGst ?? 18));
    setExtraDiscount(src.extraDiscount > 0 ? String(src.extraDiscount) : '');
    setRows(mapItemsToRows(src.items));
  };

  const resetForm = (config) => {
    applyCustomerAndMeta({ customerState: config.state || DEFAULT_STATE });
    setAmountReceived('');
    setDate(getTodayDateStr());
    setTime(getCurrentTimeStr());
  };

  // --- INITIALIZE & DEFAULTS ---
  useEffect(() => {
    async function initPage() {
      try {
        const config = await syncService.getSettings();
        setShopConfig(config);

        const [prods, invoices] = await Promise.all([syncService.getProducts(), syncService.getInvoices()]);
        setProductSuggestions(prods);
        setPastInvoices(invoices);

        if (editingInvoice) {
          applyCustomerAndMeta(editingInvoice);
          setInvoiceNumber(editingInvoice.invoiceNumber);
          setDate(editingInvoice.date);
          setTime(editingInvoice.time);
          const paid = getAmountPaid(editingInvoice);
          setAmountReceived(paid === editingInvoice.grandTotal && editingInvoice.paymentMode !== 'Credit' ? '' : String(paid));
          return;
        }

        resetForm(config);
        setInvoiceNumber(await syncService.getNextInvoiceNumber(config));

        if (prefill) {
          applyCustomerAndMeta({ ...prefill, customerState: prefill.customerState || config.state });
          onPrefillConsumed?.();
          window.Toast.info(prefill.invoiceNumber ? `Copied from invoice ${prefill.invoiceNumber}` : `New bill for ${prefill.customerName}`);
          return;
        }

        // Draft Recovery Check
        const draftStr = localStorage.getItem('billing_draft');
        if (draftStr) {
          try {
            const draft = JSON.parse(draftStr);
            const restore = await window.Dialog.confirm('An unsaved billing draft was found. Do you want to restore it?', 'Draft Recovery');
            if (restore) {
              applyCustomerAndMeta(draft);
              window.Toast.success('Draft invoice restored.');
            } else {
              localStorage.removeItem('billing_draft');
            }
          } catch (e) {
            console.warn('Draft restore parse error:', e);
          }
        }
      } catch (err) {
        console.error('Failed to initialize billing desk:', err);
        window.Toast.error('Failed to load billing data.');
      }
    }
    initPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingInvoice]);

  // --- DRAFT AUTOSAVE TIMER (reads the latest form state through a ref) ---
  useEffect(() => {
    if (editingInvoice) return; // Don't autosave while editing history entries

    const timer = setInterval(() => {
      const payload = latestPayloadRef.current;
      if (!payload) return;
      const hasData = payload.customerMobile || payload.items.length > 0 || (payload.customerName && payload.customerName !== 'Walk-in Customer');
      if (hasData) {
        const { shopConfig: _omit, ...draft } = payload;
        localStorage.setItem('billing_draft', JSON.stringify(draft));
        setAutosaveIndicator(true);
        setTimeout(() => setAutosaveIndicator(false), 800);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [editingInvoice]);

  // --- KEYBOARD SHORTCUTS: Ctrl+S save, Alt+N new row, F2 focus scanner ---
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveRef.current?.();
      } else if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setRows(prev => [...prev, createEmptyRow()]);
      } else if (e.key === 'F2') {
        e.preventDefault();
        barcodeScanInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // --- CUSTOMER LOOKUP FROM PAST INVOICES ---
  const knownCustomers = (() => {
    const map = new Map();
    pastInvoices.forEach(inv => {
      if (!inv.customerName || inv.customerName === 'Walk-in Customer') return;
      const key = inv.customerMobile || inv.customerName.toLowerCase();
      if (!map.has(key)) map.set(key, inv); // invoices are newest-first
    });
    return [...map.values()];
  })();

  const fillCustomerFrom = (inv) => {
    setCustomerName(inv.customerName || '');
    setCustomerMobile(inv.customerMobile || '');
    setCustomerAddress(inv.customerAddress || '');
    setCustomerGstin(inv.customerGstin || '');
    setCustomerState(inv.customerState || shopState);
  };

  const handleMobileChange = (value) => {
    const digits = value.replace(/[^\d+]/g, '');
    setCustomerMobile(digits);
    if (digits.length >= 10 && !customerName) {
      const match = knownCustomers.find(c => c.customerMobile === digits);
      if (match) {
        fillCustomerFrom(match);
        window.Toast.info(`Returning customer: ${match.customerName}`);
      }
    }
  };

  const handleNameChange = (value) => {
    setCustomerName(value);
    const match = knownCustomers.find(c => c.customerName === value);
    if (match && !customerMobile) fillCustomerFrom(match);
  };

  // --- ROW HANDLERS ---
  const updateRow = (id, fields) => {
    setRows(prev => prev.map(row => {
      if (row.id !== id) return row;
      const merged = { ...row, ...fields };
      const calculated = recalculateRowFields(
        toNumber(merged.qty),
        toNumber(merged.rate),
        toNumber(merged.discount),
        merged.discountType,
        toNumber(merged.gst)
      );
      return { ...merged, ...calculated };
    }));
  };

  const productToRowFields = (product, qty = 1) => {
    const fields = {
      barcode: product.barcode || '',
      name: product.name,
      hsn: product.hsn || '',
      rate: product.rate || 0,
      unit: product.unit || 'PCS',
      discount: product.discount || 0,
      discountType: 'percent', // product master default is percentage
      gst: product.gst ?? 18,
      qty
    };
    return { ...fields, ...recalculateRowFields(qty, fields.rate, fields.discount, 'percent', fields.gst) };
  };

  const handleRowSelectProduct = (id, product) => {
    setRows(prev => prev.map(row => (row.id === id ? { ...row, ...productToRowFields(product) } : row)));
    if (product.stock !== undefined && product.stock <= 0) {
      window.Toast.warn(`"${product.name}" is out of stock (${product.stock}).`);
    }
  };

  const addNewRow = () => {
    setRows(prev => [...prev, createEmptyRow()]);
  };

  const deleteRow = (id) => {
    setRows(prev => (prev.length === 1 ? [createEmptyRow()] : prev.filter(row => row.id !== id)));
  };

  // --- BARCODE SCANNER INTEGRATION ---
  const addScannedProduct = (product) => {
    setRows(prev => {
      const index = prev.findIndex(row => row.barcode.trim() === product.barcode);
      const updated = [...prev];
      if (index !== -1) {
        const target = prev[index];
        const nextQty = toNumber(target.qty) + 1;
        updated[index] = { ...target, qty: nextQty, ...recalculateRowFields(nextQty, toNumber(target.rate), toNumber(target.discount), target.discountType, toNumber(target.gst)) };
        return updated;
      }
      const blankIndex = prev.findIndex(row => !row.name.trim() && !row.barcode.trim() && !row.rate);
      if (blankIndex !== -1) {
        updated[blankIndex] = { ...updated[blankIndex], ...productToRowFields(product) };
      } else {
        updated.push({ ...createEmptyRow(), ...productToRowFields(product) });
      }
      return updated;
    });
  };

  const handleBarcodeScan = async (e) => {
    if (e.key !== 'Enter') return;
    const barcode = e.target.value.trim();
    if (!barcode) return;
    e.target.value = ''; // Reset scanner input immediately

    try {
      const product = await syncService.getProductByBarcode(barcode);
      if (product) {
        addScannedProduct(product);
        window.Toast.success(`Added "${product.name}"`);
      } else {
        window.Toast.warn(`No product registered with barcode "${barcode}".`);
      }
    } catch (err) {
      console.error('Barcode lookup failed:', err);
      window.Toast.error('Barcode lookup failed.');
    }
  };

  const handleRowBarcodeEnter = async (id, barcodeVal) => {
    if (!barcodeVal.trim()) return;
    try {
      const match = await syncService.getProductByBarcode(barcodeVal);
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

    rows.forEach(row => {
      subtotalSum += row.taxableAmount;
      const base = toNumber(row.qty) * toNumber(row.rate);
      const disc = row.discountType === 'percent' ? (base * (toNumber(row.discount) / 100)) : toNumber(row.discount);
      discountSum += disc;
      cgstSum += row.cgst;
      sgstSum += row.sgst;
    });

    const fr = toNumber(freight);
    const frGst = toNumber(freightGst, 18);
    const frTax = fr * (frGst / 100);
    const extraDisc = toNumber(extraDiscount);

    const isLocal = customerState === shopState;
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
    const grandTotal = Math.max(0, Math.round(netGross));
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
  const amountPaid = amountReceived === ''
    ? (paymentMode === 'Credit' ? 0 : totals.grandTotal)
    : Math.min(totals.grandTotal, Math.max(0, toNumber(amountReceived)));
  const balanceDue = Math.max(0, totals.grandTotal - amountPaid);

  // --- SERIALIZATION FOR SAVING ---
  const collectInvoiceData = () => {
    const items = rows
      .filter(row => row.name.trim() !== '')
      .map(row => ({
        name: row.name.trim(),
        barcode: row.barcode.trim(),
        hsn: row.hsn.trim(),
        qty: toNumber(row.qty),
        unit: row.unit.trim(),
        rate: toNumber(row.rate),
        discount: toNumber(row.discount),
        discountType: row.discountType,
        gst: toNumber(row.gst),
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
      customerGstin: customerGstin.trim().toUpperCase(),
      customerState,
      paymentMode,
      salesperson: salesperson.trim(),
      notes: notes.trim(),

      deliveryNote: deliveryNote.trim(),
      refNo: refNo.trim(),
      orderNo: orderNo.trim(),
      dispatchThrough: dispatchThrough.trim(),
      destination: destination.trim(),
      termsDelivery: termsDelivery.trim(),

      freight: toNumber(freight),
      freightGst: toNumber(freightGst, 18),
      extraDiscount: toNumber(extraDiscount),

      items,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      cgstTotal: totals.cgstTotal,
      sgstTotal: totals.sgstTotal,
      igstTotal: totals.igstTotal,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      amountPaid,
      isLocal: totals.isLocal,
      amountInWords: totals.amountInWords,
      termsAndConditions: shopConfig.terms || '',
      shopConfig
    };
  };

  latestPayloadRef.current = collectInvoiceData();

  const validateInvoice = (payload) => {
    if (payload.items.length === 0) return 'Please enter at least one item description to save.';
    if (payload.items.some(item => item.qty <= 0)) return 'Every item must have a quantity greater than zero.';
    if (payload.items.some(item => item.rate < 0)) return 'Item rates cannot be negative.';
    if (!payload.date) return 'Please select an invoice date.';
    if (payload.customerMobile && !/^(\+91)?[6-9]\d{9}$/.test(payload.customerMobile)) return 'Customer mobile must be a valid 10-digit Indian number.';
    if (payload.customerGstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(payload.customerGstin)) return 'Customer GSTIN looks invalid (15 characters, e.g. 09ABCDE1234F1Z5).';
    if (payload.paymentMode === 'Credit' && payload.customerName === 'Walk-in Customer') return 'Credit bills need a customer name so the dues can be tracked.';
    return null;
  };

  const handleSaveInvoice = async () => {
    if (saving) return;
    const payload = collectInvoiceData();

    const error = validateInvoice(payload);
    if (error) {
      window.Toast.error(error);
      return;
    }

    // Stock check (warn, but allow billing)
    const shortages = payload.items.filter(item => {
      const product = productSuggestions.find(p => (item.barcode && p.barcode === item.barcode) || p.name.toLowerCase() === item.name.toLowerCase());
      if (!product) return false;
      const alreadyBilled = editingInvoice ? (editingInvoice.items.find(i => i.name === item.name)?.qty || 0) : 0;
      return item.qty > (product.stock || 0) + alreadyBilled;
    });
    if (shortages.length > 0) {
      const proceed = await window.Dialog.confirm(
        `Low stock for: ${shortages.map(s => s.name).join(', ')}. Save the invoice anyway? Stock will go negative.`,
        'Insufficient Stock'
      );
      if (!proceed) return;
    }

    setSaving(true);
    try {
      if (editingInvoice) {
        payload.id = editingInvoice.id;
        payload.createdBy = editingInvoice.createdBy || '';
        const previousPaid = getAmountPaid(editingInvoice);
        payload.payments = editingInvoice.payments?.length
          ? editingInvoice.payments
          : (previousPaid > 0 ? [{ date: editingInvoice.date, amount: previousPaid, mode: editingInvoice.paymentMode }] : []);
        if (payload.amountPaid !== previousPaid) {
          payload.payments = [...payload.payments, { date: getTodayDateStr(), amount: payload.amountPaid - previousPaid, mode: payload.paymentMode, note: 'Adjusted on edit' }];
        }
      } else {
        // Guard against a number taken in another tab since the page loaded
        const latest = await syncService.getInvoices();
        if (latest.some(inv => inv.invoiceNumber === payload.invoiceNumber)) {
          payload.invoiceNumber = await syncService.getNextInvoiceNumber(shopConfig);
          setInvoiceNumber(payload.invoiceNumber);
        }
        payload.createdBy = user?.name || '';
        payload.payments = payload.amountPaid > 0 ? [{ date: payload.date, amount: payload.amountPaid, mode: payload.paymentMode }] : [];
      }

      const saved = await syncService.saveInvoice(payload, { previousItems: editingInvoice ? editingInvoice.items : [] });
      window.Toast.success(editingInvoice ? 'Invoice updated successfully.' : `Invoice ${saved.invoiceNumber} saved.`);
      localStorage.removeItem('billing_draft');
      onInvoiceSaved?.(saved);
    } catch (err) {
      console.error('Invoice saving failed:', err);
      window.Toast.error(`Failed to save invoice: ${err.message || 'storage error'}`);
    } finally {
      setSaving(false);
    }
  };

  saveRef.current = handleSaveInvoice;

  const handleClearInvoice = async () => {
    const confirm = await window.Dialog.confirm('Are you sure you want to discard all current entries and reset this invoice form?', 'Reset Desk');
    if (!confirm) return;
    resetForm(shopConfig);
    if (!editingInvoice) {
      setInvoiceNumber(await syncService.getNextInvoiceNumber(shopConfig));
    }
    localStorage.removeItem('billing_draft');
    window.Toast.success('Form cleared.');
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
        <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '500' }}>F2 scan · Alt+N new row · Ctrl+S save</span>
        
        {autosaveIndicator && (
          <div className="draft-autosave-status" style={{ marginLeft: 'auto', opacity: 1, transition: 'opacity 0.5s' }}>
            AutoSaved Draft
          </div>
        )}
      </div>

      {/* Meta Grid Form */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', borderBottom: '1px dashed var(--border-color)', paddingBottom: '8px' }}>
          👤 Customer & Invoice Parameters {editingInvoice && <span className="editing-badge">Editing {editingInvoice.invoiceNumber}</span>}
        </h3>
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
              {INDIAN_STATES.map(s => (
                <option key={s.code} value={s.name}>
                  {s.name} ({s.code}) {s.name === shopState ? '- Local CGST/SGST' : '- IGST'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="billing-meta-grid" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Customer Mobile (Optional)</label>
            <input type="tel" className="form-control" placeholder="10-digit number" value={customerMobile} onChange={(e) => handleMobileChange(e.target.value)} maxLength={13} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Customer Name *</label>
            <input type="text" className="form-control" placeholder="Walk-in Customer" value={customerName} onChange={(e) => handleNameChange(e.target.value)} list="known-customers" />
            <datalist id="known-customers">
              {knownCustomers.map(c => (
                <option key={c.customerMobile || c.customerName} value={c.customerName}>{c.customerMobile}</option>
              ))}
            </datalist>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Customer Address (Street/City)</label>
            <input type="text" className="form-control" placeholder="Madawara - 284404" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>GSTIN</label>
              <input type="text" className="form-control" placeholder="15-char ID" value={customerGstin} onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())} maxLength={15} />
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-light)' }}>Internal Remarks (not printed)</label>
              <input type="text" className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
                  <input type="number" className="row-qty" value={row.qty} onChange={(e) => updateRow(row.id, { qty: e.target.value })} placeholder="1" min="0" step="any" />
                </td>
                <td className="col-unit">
                  <input type="text" className="row-unit" value={row.unit} onChange={(e) => updateRow(row.id, { unit: e.target.value })} placeholder="PCS" />
                </td>
                <td className="col-rate">
                  <input type="number" className="row-rate" value={row.rate || ''} onChange={(e) => updateRow(row.id, { rate: e.target.value })} placeholder="0.00" min="0" step="any" />
                </td>
                <td className="col-discount" style={{ display: 'flex', gap: '2px', alignItems: 'center', justifyContent: 'center', height: '100%', border: 'none', padding: '6px 4px' }}>
                  <input
                    type="number"
                    className="row-discount"
                    value={row.discount || ''}
                    onChange={(e) => updateRow(row.id, { discount: e.target.value })}
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
                  <input type="number" className="row-gst" value={row.gst} onChange={(e) => updateRow(row.id, { gst: e.target.value })} placeholder="18" min="0" max="100" />
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
        <button type="button" className="btn btn-secondary" onClick={addNewRow} title="Alt+N">➕ Add Row item</button>
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

          <div className="payment-received-panel">
            <label>
              Amount Received (Rs.)
              <input
                type="number"
                className="form-control"
                min="0"
                step="any"
                placeholder={paymentMode === 'Credit' ? '0 (on credit)' : totals.grandTotal.toFixed(2)}
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
              />
            </label>
            <div className={`balance-due ${balanceDue > 0 ? 'has-due' : ''}`}>
              <span>Balance Due</span>
              <strong>Rs. {balanceDue.toFixed(2)}</strong>
            </div>
          </div>

          <div className="words-panel" style={{ marginTop: '12px' }}>
            <span>Amount Chargeable (in words)</span>
            {totals.amountInWords}
          </div>

          {/* Action buttons */}
          <div className="billing-action-buttons">
            <button className="btn btn-secondary" type="button" onClick={handleClearInvoice}>🗑️ Reset Desk</button>
            <button className="btn btn-primary" type="button" onClick={handleSaveInvoice} disabled={saving} title="Ctrl+S">
              💾 {saving ? 'Saving…' : editingInvoice ? 'Update & Save Invoice' : 'Save & Print Invoice'}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
