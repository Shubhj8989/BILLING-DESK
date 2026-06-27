import { supabase } from './supabaseClient';
import dbInstance from './db';

class SyncService {
  isOnline() {
    return supabase !== null;
  }

  async init() {
    await dbInstance.init();
  }

  async getUserId() {
    if (!this.isOnline()) return null;
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user.id;
  }

  // --- SETTINGS / PROFILE SYNC ---
  async getSettings() {
    const localDefaults = await dbInstance.getSettings();
    if (!this.isOnline()) return localDefaults;

    try {
      const uid = await this.getUserId();
      if (!uid) return localDefaults;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Row doesn't exist yet, insert defaults
          await supabase.from('profiles').insert({
            id: uid,
            shop_name: localDefaults.shopName,
            gst_number: localDefaults.gstNumber,
            address: localDefaults.address,
            mobile: localDefaults.mobile,
            bank_account: localDefaults.bankAccount,
            bank_ifsc: localDefaults.bankIfsc,
            proprietor: localDefaults.proprietor,
            invoice_prefix: localDefaults.invoicePrefix,
            invoice_start_number: Number(localDefaults.invoiceStartNumber) || 1001,
            terms: localDefaults.terms
          });
          return localDefaults;
        }
        throw error;
      }

      // Format profile columns back into settings object
      const settings = {
        shopName: data.shop_name,
        gstNumber: data.gst_number || '',
        address: data.address || '',
        mobile: data.mobile || '',
        bankAccount: data.bank_account || '',
        bankIfsc: data.bank_ifsc || '',
        proprietor: data.proprietor || '',
        invoicePrefix: data.invoice_prefix || '',
        invoiceStartNumber: Number(data.invoice_start_number) || 1001,
        terms: data.terms || ''
      };

      // Cache locally
      await dbInstance.saveSettings(settings);
      return settings;
    } catch (err) {
      console.warn('Supabase profiles fetch failed, falling back to local storage:', err);
      return localDefaults;
    }
  }

  async saveSettings(settings) {
    // Save locally
    await dbInstance.saveSettings(settings);

    if (!this.isOnline()) return settings;

    try {
      const uid = await this.getUserId();
      if (!uid) return settings;

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: uid,
          shop_name: settings.shopName,
          gst_number: settings.gstNumber,
          address: settings.address,
          mobile: settings.mobile,
          bank_account: settings.bankAccount,
          bank_ifsc: settings.bankIfsc,
          proprietor: settings.proprietor,
          invoice_prefix: settings.invoicePrefix,
          invoice_start_number: Number(settings.invoiceStartNumber) || 1001,
          terms: settings.terms
        });

      if (error) throw error;
    } catch (err) {
      console.error('Failed to sync settings profiles to Supabase:', err);
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

      const products = data.map(item => ({
        id: item.id, // Supabase bigserial primary key
        name: item.name,
        barcode: item.barcode || '',
        hsn: item.hsn || '',
        unit: item.unit || 'PCS',
        rate: item.rate,
        discount: item.discount || 0,
        gst: item.gst || 18,
        stock: item.stock || 0
      }));

      // Overwrite local IndexedDB products with this fresh synced list
      const localStore = dbInstance.db.transaction(['products'], 'readwrite').objectStore('products');
      await new Promise((resolve, reject) => {
        const clearReq = localStore.clear();
        clearReq.onsuccess = () => resolve();
        clearReq.onerror = () => reject(clearReq.error);
      });

      for (const prod of products) {
        await dbInstance.saveProduct(prod);
      }

      return products;
    } catch (err) {
      console.warn('Failed to fetch products from Supabase, loading from cache:', err);
      return dbInstance.getProducts();
    }
  }

  async saveProduct(product) {
    if (!this.isOnline()) return dbInstance.saveProduct(product);

    try {
      const uid = await this.getUserId();
      if (!uid) return dbInstance.saveProduct(product);

      const dbPayload = {
        name: product.name,
        barcode: product.barcode,
        hsn: product.hsn,
        unit: product.unit,
        rate: Number(product.rate) || 0,
        discount: Number(product.discount) || 0,
        gst: Number(product.gst) || 18,
        stock: Number(product.stock) || 0,
        user_id: uid
      };

      // If id is present and it is a large postgres ID (> 1000000 or exists in remote), update it
      // Standard local IndexedDB IDs start small (1, 2, 3) unless we override
      const hasRemoteId = product.id && typeof product.id === 'number' && product.id > 100;

      if (hasRemoteId) {
        dbPayload.id = product.id;
      }

      const { data, error } = await supabase
        .from('products')
        .upsert(dbPayload)
        .select()
        .single();

      if (error) throw error;

      // Save to local cache with the returned Supabase ID
      const syncedProduct = {
        id: data.id,
        name: data.name,
        barcode: data.barcode,
        hsn: data.hsn,
        unit: data.unit,
        rate: data.rate,
        discount: data.discount,
        gst: data.gst,
        stock: data.stock
      };
      await dbInstance.saveProduct(syncedProduct);
      return syncedProduct;
    } catch (err) {
      console.warn('Failed to save to Supabase, writing to local offline cache:', err);
      return dbInstance.saveProduct(product);
    }
  }

  async deleteProduct(id) {
    // Delete locally
    await dbInstance.deleteProduct(id);

    if (!this.isOnline()) return true;

    try {
      const uid = await this.getUserId();
      if (!uid) return true;

      // Check if id is a small local ID or remote ID
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .eq('user_id', uid);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to sync product deletion to Supabase:', err);
    }
    return true;
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

      const invoices = data.map(item => ({
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
        freight: item.freight || 0,
        freightGst: item.freight_gst || 18,
        extraDiscount: item.extra_discount || 0,
        subtotal: item.subtotal,
        discountTotal: item.discount_total || 0,
        cgstTotal: item.cgst_total || 0,
        sgstTotal: item.sgst_total || 0,
        igstTotal: item.igst_total || 0,
        roundOff: item.round_off || 0,
        grandTotal: item.grand_total,
        isLocal: item.is_local,
        amountInWords: item.amount_in_words,
        items: item.items
      }));

      // Cache locally
      const localStore = dbInstance.db.transaction(['invoices'], 'readwrite').objectStore('invoices');
      await new Promise((resolve, reject) => {
        const clearReq = localStore.clear();
        clearReq.onsuccess = () => resolve();
        clearReq.onerror = () => reject(clearReq.error);
      });

      for (const inv of invoices) {
        await dbInstance.saveInvoice(inv);
      }

      return invoices;
    } catch (err) {
      console.warn('Failed to fetch invoices from Supabase, loading from cache:', err);
      return dbInstance.getInvoices();
    }
  }

  async saveInvoice(invoice) {
    if (!this.isOnline()) return dbInstance.saveInvoice(invoice);

    try {
      const uid = await this.getUserId();
      if (!uid) return dbInstance.saveInvoice(invoice);

      const dbPayload = {
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
        freight_gst: Number(invoice.freightGst) || 18,
        extra_discount: Number(invoice.extraDiscount) || 0,
        subtotal: Number(invoice.subtotal) || 0,
        discount_total: Number(invoice.discountTotal) || 0,
        cgst_total: Number(invoice.cgstTotal) || 0,
        sgst_total: Number(invoice.sgstTotal) || 0,
        igst_total: Number(invoice.igstTotal) || 0,
        round_off: Number(invoice.roundOff) || 0,
        grand_total: Number(invoice.grandTotal) || 0,
        is_local: invoice.isLocal,
        amount_in_words: invoice.amountInWords,
        items: invoice.items,
        user_id: uid
      };

      const hasRemoteId = invoice.id && typeof invoice.id === 'number' && invoice.id > 100;
      if (hasRemoteId) {
        dbPayload.id = invoice.id;
      }

      const { data, error } = await supabase
        .from('invoices')
        .upsert(dbPayload)
        .select()
        .single();

      if (error) throw error;

      const syncedInvoice = {
        ...invoice,
        id: data.id
      };
      await dbInstance.saveInvoice(syncedInvoice);
      return syncedInvoice;
    } catch (err) {
      console.warn('Failed to save to Supabase, writing to local offline cache:', err);
      return dbInstance.saveInvoice(invoice);
    }
  }

  async deleteInvoice(id) {
    await dbInstance.deleteInvoice(id);

    if (!this.isOnline()) return true;

    try {
      const uid = await this.getUserId();
      if (!uid) return true;

      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id)
        .eq('user_id', uid);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to sync invoice deletion to Supabase:', err);
    }
    return true;
  }
}

const syncService = new SyncService();
export default syncService;
