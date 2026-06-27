import React, { useState, useEffect } from 'react';
import dbInstance from '../db/syncService';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  // Form State
  const [form, setForm] = useState({
    name: '',
    barcode: '',
    hsn: '',
    unit: 'PCS',
    rate: '',
    discount: '0',
    gst: '18',
    stock: '0'
  });

  const loadProducts = async () => {
    try {
      const list = await dbInstance.getProducts();
      setProducts(list);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const openAddModal = () => {
    setEditingProduct(null);
    setForm({
      name: '',
      barcode: '',
      hsn: '',
      unit: 'PCS',
      rate: '',
      discount: '0',
      gst: '18',
      stock: '0'
    });
    setIsOpen(true);
  };

  const openEditModal = (p) => {
    setEditingProduct(p);
    setForm({
      name: p.name,
      barcode: p.barcode || '',
      hsn: p.hsn || '',
      unit: p.unit || 'PCS',
      rate: String(p.rate),
      discount: String(p.discount || 0),
      gst: String(p.gst || 18),
      stock: String(p.stock || 0)
    });
    setIsOpen(true);
  };

  const handleDelete = async (id) => {
    const confirm = await window.Dialog.confirm('Are you sure you want to delete this product from your inventory?', 'Confirm Deletion');
    if (confirm) {
      try {
        await dbInstance.deleteProduct(id);
        window.Toast.success('Product deleted from inventory.');
        loadProducts();
      } catch (err) {
        console.error('Deletion failed:', err);
        window.Toast.error('Failed to delete product.');
      }
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    const name = form.name.trim();
    const barcode = form.barcode.trim();
    const hsn = form.hsn.trim();
    const unit = form.unit;
    const rate = parseFloat(form.rate);
    const discount = parseFloat(form.discount) || 0;
    const gst = parseInt(form.gst);
    const stock = parseInt(form.stock) || 0;

    if (!name) {
      window.Toast.error('Please enter a product name.');
      return;
    }
    if (isNaN(rate) || rate <= 0) {
      window.Toast.error('Please enter a valid rate greater than zero.');
      return;
    }
    if (isNaN(discount) || discount < 0 || discount > 100) {
      window.Toast.error('Please enter a valid discount percentage (0-100).');
      return;
    }
    if (isNaN(gst) || gst < 0 || gst > 100) {
      window.Toast.error('Please select a valid GST percentage.');
      return;
    }

    const payload = {
      name,
      barcode,
      hsn,
      unit,
      rate,
      discount,
      gst,
      stock
    };

    if (editingProduct) {
      payload.id = editingProduct.id;
    }

    try {
      await dbInstance.saveProduct(payload);
      window.Toast.success(editingProduct ? 'Product updated successfully.' : 'Product added to inventory.');
      setIsOpen(false);
      loadProducts();
    } catch (err) {
      console.error('Save failed:', err);
      window.Toast.error('Failed to save product details.');
    }
  };

  return (
    <div className="products-layout">
      {/* Header section */}
      <div className="table-actions-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '12px 24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={{ fontWeight: '700', fontSize: '15px' }}>Product Catalog ({products.length} Items)</div>
        <button className="btn btn-primary" onClick={openAddModal}>➕ Add New Product</button>
      </div>

      {/* Grid inventory */}
      <div className="billing-table-container">
        <table className="billing-table">
          <thead>
            <tr>
              <th style={{ padding: '12px 8px' }}>Barcode</th>
              <th>Product Name</th>
              <th>HSN/SAC</th>
              <th>Unit</th>
              <th>Rate (₹)</th>
              <th>Default Disc %</th>
              <th>GST %</th>
              <th>Stock</th>
              <th style={{ width: '100px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
                  No products registered in the master catalog. Click "Add New Product" to populate your inventory.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id}>
                  <td style={{ padding: '12px 8px' }}><code>{p.barcode || '-'}</code></td>
                  <td style={{ textAlign: 'left', fontWeight: '600' }}>{p.name}</td>
                  <td>{p.hsn || '-'}</td>
                  <td>{p.unit}</td>
                  <td>₹{p.rate.toFixed(2)}</td>
                  <td>{p.discount || 0}%</td>
                  <td>{p.gst}%</td>
                  <td style={{ fontWeight: '600', color: p.stock <= 5 ? 'var(--error)' : 'inherit' }}>{p.stock}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => openEditModal(p)}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        ✏️
                      </button>
                      <button 
                        className="btn btn-danger" 
                        onClick={() => handleDelete(p.id)}
                        style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: 'var(--error)', border: 'none', color: '#fff' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Save Product Modal */}
      {isOpen && (
        <div className="dialog-overlay active" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div className="dialog-box" style={{ width: '450px', transform: 'scale(1)', opacity: 1 }}>
            <div className="dialog-header">
              <h3>{editingProduct ? '✏️ Edit Product' : '➕ Add New Product'}</h3>
              <button className="dialog-close-btn" onClick={() => setIsOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleFormSubmit}>
              <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Product Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Luxury Leather Sofa Set"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Barcode / Universal Serial (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Scan barcode or type value"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>HSN/SAC Code</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 9403"
                      value={form.hsn}
                      onChange={(e) => setForm({ ...form, hsn: e.target.value })}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Unit</label>
                    <select
                      className="form-control"
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-input)' }}
                    >
                      <option value="PCS">PCS (Pieces)</option>
                      <option value="SET">SET (Sets)</option>
                      <option value="BOX">BOX (Boxes)</option>
                      <option value="MTR">MTR (Meters)</option>
                      <option value="KGS">KGS (Kilograms)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Rate (₹) *</label>
                    <input
                      type="number"
                      step="any"
                      className="form-control"
                      placeholder="Selling price"
                      value={form.rate}
                      onChange={(e) => setForm({ ...form, rate: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Default Discount %</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      className="form-control"
                      placeholder="Auto default discount"
                      value={form.discount}
                      onChange={(e) => setForm({ ...form, discount: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>GST Slab %</label>
                    <select
                      className="form-control"
                      value={form.gst}
                      onChange={(e) => setForm({ ...form, gst: e.target.value })}
                      style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-input)' }}
                    >
                      <option value="0">0% (Exempt)</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18% (Standard)</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-light)' }}>Initial Stock</label>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      placeholder="Current stock level"
                      value={form.stock}
                      onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    />
                  </div>
                </div>

              </div>
              <div className="dialog-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingProduct ? 'Update Product' : 'Add Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
