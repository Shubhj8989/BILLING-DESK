import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import syncService from '../db/syncService';
import { formatINR, getTodayDateStr } from '../utils/invoice';

const EMPTY_FORM = {
  name: '',
  barcode: '',
  hsn: '',
  category: '',
  unit: 'PCS',
  rate: '',
  purchaseRate: '',
  discount: '0',
  gst: '18',
  stock: '0'
};

const UNITS = ['PCS', 'SET', 'BOX', 'MTR', 'KGS', 'NOS', 'PAIR'];
const GST_SLABS = ['0', '5', '12', '18', '28'];

// Internal 12-digit barcode for items without a manufacturer code
function generateBarcode(existing) {
  let code;
  do {
    code = '2' + String(Date.now()).slice(-7) + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  } while (existing.has(code));
  return code;
}

function FormField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>{label}</label>
      {children}
    </div>
  );
}

export default function Products({ canEdit, shopConfig }) {
  const [products, setProducts] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const importInputRef = useRef(null);

  const lowStockThreshold = Number(shopConfig?.lowStockThreshold) || 5;

  const loadProducts = async () => {
    try {
      const list = await syncService.getProducts();
      list.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(list);
    } catch (err) {
      console.error('Failed to load products:', err);
      window.Toast.error('Failed to load products.');
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const openAddModal = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setIsOpen(true);
  };

  const openEditModal = (p) => {
    setEditingProduct(p);
    setForm({
      name: p.name,
      barcode: p.barcode || '',
      hsn: p.hsn || '',
      category: p.category || '',
      unit: p.unit || 'PCS',
      rate: String(p.rate),
      purchaseRate: p.purchaseRate ? String(p.purchaseRate) : '',
      discount: String(p.discount || 0),
      gst: String(p.gst ?? 18),
      stock: String(p.stock || 0)
    });
    setIsOpen(true);
  };

  const handleDelete = async (p) => {
    const confirm = await window.Dialog.confirm(`Delete "${p.name}" from your inventory?`, 'Confirm Deletion', 'btn-danger');
    if (!confirm) return;
    try {
      await syncService.deleteProduct(p.id);
      window.Toast.success('Product deleted from inventory.');
      loadProducts();
    } catch (err) {
      console.error('Deletion failed:', err);
      window.Toast.error('Failed to delete product.');
    }
  };

  const handleAdjustStock = async (p) => {
    const input = await window.Dialog.prompt(
      `Current stock of "${p.name}" is ${p.stock}. Enter quantity to add (use a minus sign to remove, e.g. -2):`,
      '',
      'Adjust Stock',
      'e.g. 10'
    );
    if (input === false || input === '') return;
    const delta = parseFloat(input);
    if (Number.isNaN(delta) || delta === 0) {
      window.Toast.error('Enter a non-zero number.');
      return;
    }
    try {
      await syncService.saveProduct({ ...p, stock: (Number(p.stock) || 0) + delta });
      window.Toast.success(`Stock updated: ${p.name} → ${(Number(p.stock) || 0) + delta}`);
      loadProducts();
    } catch (err) {
      window.Toast.error(err.message || 'Failed to update stock.');
    }
  };

  const validateProduct = (payload, ignoreId) => {
    if (!payload.name) return 'Please enter a product name.';
    if (Number.isNaN(payload.rate) || payload.rate <= 0) return 'Please enter a valid rate greater than zero.';
    if (payload.discount < 0 || payload.discount > 100) return 'Discount must be between 0 and 100%.';
    if (Number.isNaN(payload.gst) || payload.gst < 0 || payload.gst > 100) return 'Please select a valid GST percentage.';
    const clash = products.find(p => p.id !== ignoreId && (
      (payload.barcode && p.barcode === payload.barcode) ||
      p.name.trim().toLowerCase() === payload.name.toLowerCase()
    ));
    if (clash) {
      return clash.barcode && clash.barcode === payload.barcode
        ? `Barcode ${payload.barcode} is already used by "${clash.name}".`
        : `A product named "${clash.name}" already exists.`;
    }
    return null;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      barcode: form.barcode.trim(),
      hsn: form.hsn.trim(),
      category: form.category.trim(),
      unit: form.unit,
      rate: parseFloat(form.rate),
      purchaseRate: parseFloat(form.purchaseRate) || 0,
      discount: parseFloat(form.discount) || 0,
      gst: parseFloat(form.gst),
      stock: parseFloat(form.stock) || 0
    };
    const error = validateProduct(payload, editingProduct?.id);
    if (error) {
      window.Toast.error(error);
      return;
    }
    if (editingProduct) payload.id = editingProduct.id;

    setSaving(true);
    try {
      await syncService.saveProduct(payload);
      window.Toast.success(editingProduct ? 'Product updated successfully.' : 'Product added to inventory.');
      setIsOpen(false);
      loadProducts();
    } catch (err) {
      console.error('Save failed:', err);
      window.Toast.error(err.message || 'Failed to save product details.');
    } finally {
      setSaving(false);
    }
  };

  // --- EXCEL EXPORT / IMPORT ---
  const handleExport = () => {
    const rows = products.map(p => ({
      Name: p.name,
      Barcode: p.barcode || '',
      HSN: p.hsn || '',
      Category: p.category || '',
      Unit: p.unit,
      Rate: p.rate,
      PurchaseRate: p.purchaseRate || 0,
      DiscountPercent: p.discount || 0,
      GSTPercent: p.gst,
      Stock: p.stock
    }));
    if (rows.length === 0) {
      rows.push({ Name: 'Sample Sofa', Barcode: '', HSN: '9401', Category: 'Sofa', Unit: 'SET', Rate: 25000, PurchaseRate: 18000, DiscountPercent: 0, GSTPercent: 18, Stock: 5 });
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, `Products_${getTodayDateStr()}.xlsx`);
    window.Toast.success(products.length ? 'Product list exported.' : 'Downloaded a sample import template.');
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const pick = (row, ...keys) => {
        const found = Object.keys(row).find(k => keys.includes(k.toLowerCase().replace(/[^a-z]/g, '')));
        return found ? row[found] : '';
      };

      let added = 0;
      let updated = 0;
      let skipped = 0;
      const byBarcode = new Map(products.filter(p => p.barcode).map(p => [p.barcode, p]));
      const byName = new Map(products.map(p => [p.name.trim().toLowerCase(), p]));

      for (const row of rows) {
        const name = String(pick(row, 'name', 'productname', 'product', 'item')).trim();
        const rate = parseFloat(pick(row, 'rate', 'price', 'sellingprice', 'mrp'));
        if (!name || Number.isNaN(rate) || rate <= 0) {
          skipped++;
          continue;
        }
        const barcode = String(pick(row, 'barcode', 'code', 'sku')).trim();
        const gstRaw = parseFloat(pick(row, 'gstpercent', 'gst', 'tax'));
        const existing = (barcode && byBarcode.get(barcode)) || byName.get(name.toLowerCase());
        const product = {
          ...(existing || {}),
          name,
          barcode,
          hsn: String(pick(row, 'hsn', 'hsnsac', 'hsncode')).trim(),
          category: String(pick(row, 'category', 'group')).trim(),
          unit: String(pick(row, 'unit', 'uom')).trim().toUpperCase() || 'PCS',
          rate,
          purchaseRate: parseFloat(pick(row, 'purchaserate', 'cost', 'costprice')) || 0,
          discount: parseFloat(pick(row, 'discountpercent', 'discount')) || 0,
          gst: Number.isNaN(gstRaw) ? 18 : gstRaw,
          stock: parseFloat(pick(row, 'stock', 'qty', 'quantity')) || 0
        };
        await syncService.saveProduct(product);
        if (existing) updated++;
        else added++;
      }
      window.Toast.success(`Import done: ${added} added, ${updated} updated${skipped ? `, ${skipped} skipped (missing name/rate)` : ''}.`, 5000);
      loadProducts();
    } catch (err) {
      console.error('Import failed:', err);
      window.Toast.error('Could not read that file. Use an .xlsx or .csv with Name and Rate columns.');
    }
  };

  // --- FILTERING ---
  const q = search.trim().toLowerCase();
  const visible = products.filter(p => {
    if (q && !(p.name.toLowerCase().includes(q) || (p.barcode || '').includes(q) || (p.hsn || '').includes(q) || (p.category || '').toLowerCase().includes(q))) return false;
    if (stockFilter === 'low' && !(p.stock > 0 && p.stock <= lowStockThreshold)) return false;
    if (stockFilter === 'out' && p.stock > 0) return false;
    return true;
  });
  const stockValue = products.reduce((sum, p) => sum + Math.max(0, p.stock) * (p.purchaseRate || p.rate), 0);
  const lowCount = products.filter(p => p.stock <= lowStockThreshold).length;

  return (
    <div className="products-layout">
      <div className="table-actions-row records-filter-bar">
        <div style={{ fontWeight: '700', fontSize: '15px', whiteSpace: 'nowrap' }}>Catalog ({products.length})</div>
        <input
          type="text"
          className="form-control"
          placeholder="Search name, barcode, HSN, category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '2 1 220px', textAlign: 'left' }}
        />
        <select className="form-control" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} style={{ flex: '0 1 150px' }}>
          <option value="all">All stock</option>
          <option value="low">Low stock (≤ {lowStockThreshold})</option>
          <option value="out">Out of stock</option>
        </select>
        <button className="btn btn-secondary" onClick={handleExport} title="Also serves as an import template">📥 Export</button>
        {canEdit && (
          <>
            <button className="btn btn-secondary" onClick={() => importInputRef.current?.click()}>📤 Import</button>
            <input type="file" accept=".xlsx,.xls,.csv" ref={importInputRef} onChange={handleImportFile} style={{ display: 'none' }} />
            <button className="btn btn-primary" onClick={openAddModal}>➕ Add Product</button>
          </>
        )}
      </div>

      <div className="records-summary">
        Stock value (at cost): <strong>{formatINR(stockValue)}</strong>
        {lowCount > 0 && <> · <span style={{ color: 'var(--error)' }}>{lowCount} item(s) low or out of stock</span></>}
      </div>

      <div className="billing-table-container">
        <table className="billing-table">
          <thead>
            <tr>
              <th style={{ padding: '12px 8px' }}>Barcode</th>
              <th>Product Name</th>
              <th>HSN/SAC</th>
              <th>Unit</th>
              <th>Rate (Rs.)</th>
              <th>Disc %</th>
              <th>GST %</th>
              <th>Stock</th>
              {canEdit && <th style={{ width: '130px' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 9 : 8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                  {products.length === 0
                    ? 'No products yet. Click "Add Product", or "Import" an Excel sheet with Name and Rate columns.'
                    : 'No products match your search.'}
                </td>
              </tr>
            ) : (
              visible.map((p) => (
                <tr key={p.id}>
                  <td style={{ padding: '12px 8px' }}><code>{p.barcode || '-'}</code></td>
                  <td style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: '600' }}>{p.name}</div>
                    {p.category && <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>{p.category}</div>}
                  </td>
                  <td>{p.hsn || '-'}</td>
                  <td>{p.unit}</td>
                  <td>{Number(p.rate).toFixed(2)}</td>
                  <td>{p.discount || 0}%</td>
                  <td>{p.gst}%</td>
                  <td style={{ fontWeight: '600', color: p.stock <= 0 ? 'var(--error)' : p.stock <= lowStockThreshold ? 'var(--warning)' : 'inherit' }}>
                    {p.stock}
                  </td>
                  {canEdit && (
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button className="btn btn-secondary" title="Adjust stock" onClick={() => handleAdjustStock(p)} style={{ padding: '4px 8px', fontSize: '12px' }}>±</button>
                        <button className="btn btn-secondary" title="Edit" onClick={() => openEditModal(p)} style={{ padding: '4px 8px', fontSize: '12px' }}>✏️</button>
                        <button className="btn btn-danger" title="Delete" onClick={() => handleDelete(p)} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: 'var(--error)', border: 'none', color: '#fff' }}>🗑️</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <div className="dialog-overlay active" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div className="dialog-box" style={{ width: '480px', maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto', transform: 'scale(1)', opacity: 1 }}>
            <div className="dialog-header">
              <h3>{editingProduct ? '✏️ Edit Product' : '➕ Add New Product'}</h3>
              <button className="dialog-close-btn" onClick={() => setIsOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleFormSubmit}>
              <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <FormField label="Product Name *">
                  <input type="text" className="form-control" placeholder="e.g. Luxury Leather Sofa Set" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
                </FormField>

                <FormField label="Barcode / Serial (scan, type, or generate)">
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input type="text" className="form-control" placeholder="Scan barcode or type value" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} style={{ flex: 1 }} />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setForm({ ...form, barcode: generateBarcode(new Set(products.map(p => p.barcode))) })}
                    >
                      Generate
                    </button>
                  </div>
                </FormField>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <FormField label="HSN/SAC Code">
                    <input type="text" className="form-control" placeholder="e.g. 9403" value={form.hsn} onChange={(e) => setForm({ ...form, hsn: e.target.value })} />
                  </FormField>
                  <FormField label="Category">
                    <input type="text" className="form-control" placeholder="e.g. Sofa, Bed, TV" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} list="product-categories" />
                    <datalist id="product-categories">
                      {[...new Set(products.map(p => p.category).filter(Boolean))].map(c => <option key={c} value={c} />)}
                    </datalist>
                  </FormField>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <FormField label="Selling Rate (Rs.) *">
                    <input type="number" step="any" min="0" className="form-control" placeholder="Selling price (before GST)" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} required />
                  </FormField>
                  <FormField label="Purchase Rate (Rs.)">
                    <input type="number" step="any" min="0" className="form-control" placeholder="For profit & stock value" value={form.purchaseRate} onChange={(e) => setForm({ ...form, purchaseRate: e.target.value })} />
                  </FormField>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <FormField label="Unit">
                    <select className="form-control" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </FormField>
                  <FormField label="GST Slab %">
                    <select className="form-control" value={form.gst} onChange={(e) => setForm({ ...form, gst: e.target.value })}>
                      {GST_SLABS.map(g => <option key={g} value={g}>{g}%</option>)}
                    </select>
                  </FormField>
                  <FormField label="Default Disc %">
                    <input type="number" step="any" min="0" max="100" className="form-control" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
                  </FormField>
                </div>

                <FormField label={editingProduct ? 'Current Stock' : 'Opening Stock'}>
                  <input type="number" step="any" className="form-control" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                </FormField>
              </div>
              <div className="dialog-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editingProduct ? 'Update Product' : 'Add Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
