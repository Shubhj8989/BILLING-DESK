import { supabase } from './supabaseClient';
import dbInstance from './db';

// --- Column mapping helpers (camelCase app <-> snake_case Supabase) ---
function settingsToProfile(settings, uid) {
  return {
    id: uid,
    shop_name: settings.shopName,
    gst_number: settings.gstNumber,
    address: settings.address,
    state: settings.state,
    mobile: settings.mobile,
    email: settings.email,
    bank_name: settings.bankName,
    bank_account: settings.bankAccount,
    bank_ifsc: settings.bankIfsc,
    upi_id: settings.upiId,
    proprietor: settings.proprietor,
    invoice_prefix: settings.invoicePrefix,
    invoice_start_number: Number(settings.invoiceStartNumber) || 1001,
    low_stock_threshold: Number(settings.lowStockThreshold) || 5,
    terms: settings.terms
  };
}

function profileToSettings(data, defaults) {
  return {
    ...defaults,
    shopName: data.shop_name || defaults.shopName,
    gstNumber: data.gst_number || '',
    address: data.address || '',
    state: data.state || defaults.state,
    mobile: data.mobile || '',
    email: data.email || '',
    bankName: data.bank_name || '',
    bankAccount: data.bank_account || '',
    bankIfsc: data.bank_ifsc || '',
    upiId: data.upi_id || '',
    proprietor: data.proprietor || '',
    invoicePrefix: data.invoice_prefix || '',
    invoiceStartNumber: Number(data.invoice_start_number) || 1001,
    lowStockThreshold: Number(data.low_stock_threshold) || 5,
    terms: data.terms || ''
  };
}

function rowToProduct(item) {
  return {
    id: item.id,
    name: item.name,
    barcode: item.barcode || '',
    hsn: item.hsn || '',
    unit: item.unit || 'PCS',
    rate: Number(item.rate) || 0,
    purchaseRate: Number(item.purchase_rate) || 0,
    discount: Number(item.discount) || 0,
    gst: item.gst ?? 18,
    stock: Number(item.stock) || 0,
    category: item.category || ''
  };
}

function rowToInvoice(item) {
  return {
    id: item.id,
    invoiceNumber: item.invoice_number,
    date: item.date,
    time: item.time,
    customerName: item.customer_name,
    customerAddress: item.customer_address || '',
    customerMobile: item.customer_mobile || '',
    customerGstin: item.customer_gstin || '',
    customerState: item.customer_state || 'Uttar Pradesh',
    paymentMode: item.payment_mode || 'Cash',
    salesperson: item.salesperson || '',
    deliveryNote: item.delivery_note || '',
    refNo: item.ref_no || '',
    orderNo: item.order_no || '',
    dispatchThrough: item.dispatch_through || '',
    destination: item.destination || '',
    termsDelivery: item.terms_delivery || '',
    freight: Number(item.freight) || 0,
    freightGst: item.freight_gst ?? 18,
    extraDiscount: Number(item.extra_discount) || 0,
    subtotal: Number(item.subtotal) || 0,
    discountTotal: Number(item.discount_total) || 0,
    cgstTotal: Number(item.cgst_total) || 0,
    sgstTotal: Number(item.sgst_total) || 0,
    igstTotal: Number(item.igst_total) || 0,
    roundOff: Number(item.round_off) || 0,
    grandTotal: Number(item.grand_total) || 0,
    amountPaid: item.amount_paid ?? (item.payment_mode === 'Credit' ? 0 : Number(item.grand_total) || 0),
    payments: item.payments || [],
    notes: item.notes || '',
    isLocal: item.is_local,
    amountInWords: item.amount_in_words,
    items: item.items || [],
    shopConfig: item.shop_config || undefined,
    createdBy: item.created_by || ''
  };
}

function invoiceToRow(invoice, uid) {
  return {
    invoice_number: invoice.invoiceNumber,
    date: invoice.date,
    time: invoice.time,
    customer_name: invoice.customerName,
    customer_address: invoice.customerAddress,
    customer_mobile: invoice.customerMobile,
    customer_gstin: invoice.customerGstin,
    customer_state: invoice.customerState,
    payment_mode: invoice.paymentMode,
    salesperson: invoice.salesperson,
    delivery_note: invoice.deliveryNote,
    ref_no: invoice.refNo,
    order_no: invoice.orderNo,
    dispatch_through: invoice.dispatchThrough,
    destination: invoice.destination,
    terms_delivery: invoice.termsDelivery,
    freight: Number(invoice.freight) || 0,
    freight_gst: Number(invoice.freightGst) || 0,
    extra_discount: Number(invoice.extraDiscount) || 0,
    subtotal: Number(invoice.subtotal) || 0,
    discount_total: Number(invoice.discountTotal) || 0,
    cgst_total: Number(invoice.cgstTotal) || 0,
    sgst_total: Number(invoice.sgstTotal) || 0,
    igst_total: Number(invoice.igstTotal) || 0,
    round_off: Number(invoice.roundOff) || 0,
    grand_total: Number(invoice.grandTotal) || 0,
    amount_paid: Number(invoice.amountPaid) || 0,
    payments: invoice.payments || [],
    notes: invoice.notes || '',
    is_local: invoice.isLocal,
    amount_in_words: invoice.amountInWords,
    items: invoice.items,
    shop_config: invoice.shopConfig || null,
    created_by: invoice.createdBy || '',
    user_id: uid
  };
}

// Extract the trailing number of an invoice serial, e.g. "VFH/1023" -> 1023
function serialNumber(invoiceNumber, prefix) {
  if (!invoiceNumber || (prefix && !invoiceNumber.startsWith(prefix))) return null;
  const match = invoiceNumber.slice(prefix.length).match(/^(\d+)$/);
  return match ? Number(match[1]) : null;
}

function productKey(item) {
  if (item.barcode && item.barcode.trim()) return `b:${item.barcode.trim()}`;
  return `n:${String(item.name || '').trim().toLowerCase()}`;
}

class SyncService {
  constructor() {
    this.cloudEnabled = false;
  }

  // Cloud sync is only used while a Supabase account is signed in
  setCloudEnabled(enabled) {
    this.cloudEnabled = Boolean(enabled) && supabase !== null;
  }

  isOnline() {
    return this.cloudEnabled;
  }

  async init() {
    await dbInstance.init();
  }

  async getUserId() {
    if (!this.isOnline()) return null;
    const { data } = await supabase.auth.getSession();
    return data.session ? data.session.user.id : null;
  }

  // --- SETTINGS / PROFILE SYNC ---
  async getSettings() {
    const localSettings = await dbInstance.getSettings();
    if (!this.isOnline()) return localSettings;

    try {
      const uid = await this.getUserId();
      if (!uid) return localSettings;

      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (error) throw error;

      if (!data) {
        await supabase.from('profiles').insert(settingsToProfile(localSettings, uid));
        return localSettings;
      }

      const settings = profileToSettings(data, localSettings);
      await dbInstance.saveSettings(settings);
      return settings;
    } catch (err) {
      console.warn('Supabase profiles fetch failed, falling back to local storage:', err);
      return localSettings;
    }
  }

  async saveSettings(settings) {
    await dbInstance.saveSettings(settings);
    if (!this.isOnline()) return settings;

    try {
      const uid = await this.getUserId();
      if (!uid) return settings;
      const { error } = await supabase.from('profiles').upsert(settingsToProfile(settings, uid));
      if (error) throw error;
    } catch (err) {
      console.error('Failed to sync settings to Supabase:', err);
      window.Toast?.warn('Saved locally, but cloud sync failed.');
    }
    return settings;
  }

  // --- PRODUCTS SYNC ---
  async getProducts() {
    if (!this.isOnline()) return dbInstance.getProducts();

    try {
      const uid = await this.getUserId();
      if (!uid) return dbInstance.getProducts();

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', uid)
        .order('name', { ascending: true });
      if (error) throw error;

      const products = data.map(rowToProduct);
      await this._replaceLocalStore('products', products);
      return products;
    } catch (err) {
      console.warn('Failed to fetch products from Supabase, loading from cache:', err);
      return dbInstance.getProducts();
    }
  }

  async getProductByBarcode(barcode) {
    const code = String(barcode || '').trim();
    if (!code) return null;
    const local = await dbInstance.getProductByBarcode(code);
    if (local) return local;
    // Cache may be stale in cloud mode, refresh once
    if (this.isOnline()) {
      const products = await this.getProducts();
      return products.find(p => p.barcode === code) || null;
    }
    return null;
  }

  async saveProduct(product) {
    if (!this.isOnline()) {
      const id = await dbInstance.saveProduct(product);
      return { ...product, id };
    }

    try {
      const uid = await this.getUserId();
      if (!uid) throw new Error('Not signed in to cloud');

      const payload = {
        name: product.name,
        barcode: product.barcode,
        hsn: product.hsn,
        unit: product.unit,
        rate: Number(product.rate) || 0,
        purchase_rate: Number(product.purchaseRate) || 0,
        discount: Number(product.discount) || 0,
        gst: Number(product.gst) || 0,
        stock: Number(product.stock) || 0,
        category: product.category || '',
        user_id: uid
      };
      if (product.id) payload.id = product.id;

      const { data, error } = await supabase.from('products').upsert(payload).select().single();
      if (error) throw error;

      const synced = rowToProduct(data);
      await dbInstance.saveProduct(synced);
      return synced;
    } catch (err) {
      console.error('Failed to save product to Supabase:', err);
      throw new Error('Cloud save failed. Check your connection and try again.');
    }
  }

  async deleteProduct(id) {
    if (this.isOnline()) {
      const uid = await this.getUserId();
      const { error } = await supabase.from('products').delete().eq('id', id).eq('user_id', uid);
      if (error) throw error;
    }
    await dbInstance.deleteProduct(id);
    return true;
  }

  // Applies stock movement: items being removed from an invoice are added back,
  // items being billed are deducted. Matches products by barcode, else by name.
  async adjustStock(previousItems = [], nextItems = []) {
    const deltas = new Map();
    previousItems.forEach(item => {
      const key = productKey(item);
      deltas.set(key, (deltas.get(key) || 0) + (Number(item.qty) || 0));
    });
    nextItems.forEach(item => {
      const key = productKey(item);
      deltas.set(key, (deltas.get(key) || 0) - (Number(item.qty) || 0));
    });

    const products = await dbInstance.getProducts();
    const byKey = new Map();
    products.forEach(p => {
      if (p.barcode) byKey.set(`b:${p.barcode.trim()}`, p);
      byKey.set(`n:${p.name.trim().toLowerCase()}`, p);
    });

    for (const [key, delta] of deltas) {
      if (!delta) continue;
      const product = byKey.get(key);
      if (!product) continue;
      const updated = { ...product, stock: (Number(product.stock) || 0) + delta };
      try {
        await this.saveProduct(updated);
        // keep the in-memory index in sync for later rows of the same product
        byKey.set(key, updated);
      } catch (err) {
        console.warn('Stock update failed for', product.name, err);
      }
    }
  }

  // --- INVOICES SYNC ---
  async getInvoices() {
    if (!this.isOnline()) return dbInstance.getInvoices();

    try {
      const uid = await this.getUserId();
      if (!uid) return dbInstance.getInvoices();

      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', uid)
        .order('date', { ascending: false })
        .order('time', { ascending: false });
      if (error) throw error;

      const invoices = data.map(rowToInvoice);
      await this._replaceLocalStore('invoices', invoices);
      return invoices;
    } catch (err) {
      console.warn('Failed to fetch invoices from Supabase, loading from cache:', err);
      return dbInstance.getInvoices();
    }
  }

  // Next serial = highest existing serial for this prefix + 1 (never re-uses numbers after deletes)
  async getNextInvoiceNumber(config) {
    const prefix = config.invoicePrefix || '';
    const start = Number(config.invoiceStartNumber) || 1001;
    const invoices = await this.getInvoices();
    let max = start - 1;
    invoices.forEach(inv => {
      const n = serialNumber(inv.invoiceNumber, prefix);
      if (n !== null && n > max) max = n;
    });
    return `${prefix}${max + 1}`;
  }

  async saveInvoice(invoice, { previousItems = [] } = {}) {
    let saved;
    if (!this.isOnline()) {
      const id = await dbInstance.saveInvoice(invoice);
      saved = { ...invoice, id };
    } else {
      const uid = await this.getUserId();
      if (!uid) throw new Error('Cloud session expired. Please sign in again.');
      const payload = invoiceToRow(invoice, uid);
      if (invoice.id) payload.id = invoice.id;

      const { data, error } = await supabase.from('invoices').upsert(payload).select().single();
      if (error) throw error;
      saved = { ...invoice, id: data.id };
      await dbInstance.saveInvoice(saved);
    }

    await this.adjustStock(previousItems, invoice.items);
    return saved;
  }

  // Records a payment against an invoice without touching stock
  async updateInvoicePayment(invoice) {
    if (!this.isOnline()) {
      await dbInstance.saveInvoice(invoice);
      return invoice;
    }
    const uid = await this.getUserId();
    const { error } = await supabase
      .from('invoices')
      .update({ amount_paid: Number(invoice.amountPaid) || 0, payments: invoice.payments || [] })
      .eq('id', invoice.id)
      .eq('user_id', uid);
    if (error) throw error;
    await dbInstance.saveInvoice(invoice);
    return invoice;
  }

  async deleteInvoice(invoice, { restoreStock = true } = {}) {
    if (this.isOnline()) {
      const uid = await this.getUserId();
      const { error } = await supabase.from('invoices').delete().eq('id', invoice.id).eq('user_id', uid);
      if (error) throw error;
    }
    await dbInstance.deleteInvoice(invoice.id);
    if (restoreStock) await this.adjustStock(invoice.items || [], []);
    return true;
  }

  // --- BACKUP / RESET (always local) ---
  importBackup(data) {
    return dbInstance.importBackup(data);
  }

  clearAll() {
    return dbInstance.clearAll();
  }

  async _replaceLocalStore(storeName, records) {
    const tx = dbInstance.db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    records.forEach(record => store.put(record));
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

const syncService = new SyncService();
export default syncService;
