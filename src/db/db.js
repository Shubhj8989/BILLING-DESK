class AppDB {
  constructor() {
    this.dbName = 'VardhmanBillingDB';
    this.dbVersion = 1;
    this.db = null;
  }

  // Initialize DB
  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Settings Store (Key-Value)
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }

        // Products Store
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
          productStore.createIndex('barcode', 'barcode', { unique: false });
          productStore.createIndex('name', 'name', { unique: false });
          productStore.createIndex('code', 'code', { unique: false });
        }

        // Invoices Store
        if (!db.objectStoreNames.contains('invoices')) {
          const invoiceStore = db.createObjectStore('invoices', { keyPath: 'id', autoIncrement: true });
          invoiceStore.createIndex('invoiceNumber', 'invoiceNumber', { unique: true });
          invoiceStore.createIndex('date', 'date', { unique: false });
          invoiceStore.createIndex('customerMobile', 'customerMobile', { unique: false });
          invoiceStore.createIndex('customerName', 'customerName', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this);
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  // --- SETTINGS OPERATIONS ---
  getSettings() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get('shop_config');

      request.onsuccess = () => {
        const defaultSettings = {
          shopName: 'Vardhman Furniture House and Electronics',
          gstNumber: '09AZUPJ8074C1ZV',
          address: 'Infront of Bharat Petroleum, Mahroni Road, Madawara - 284404',
          mobile: '9907879457',
          bankAccount: '50200094231111',
          bankIfsc: 'HDFC0008617',
          proprietor: 'SHIVAM JAIN',
          logo: '',
          invoicePrefix: 'VFH/',
          invoiceStartNumber: 1001,
          terms: '1. Goods once sold will not be taken back.\n2. Warranty as per manufacturer terms.\n3. Subject to local jurisdiction.'
        };
        const result = request.result || defaultSettings;

        // Auto-upgrade configuration if old settings or placeholders exist
        if (!request.result || !result.bankAccount || result.proprietor !== 'SHIVAM JAIN' || result.gstNumber !== '09AZUPJ8074C1ZV') {
          Object.assign(result, defaultSettings);
          const writeTx = this.db.transaction(['settings'], 'readwrite');
          const writeStore = writeTx.objectStore('settings');
          writeStore.put(result, 'shop_config');
        }

        resolve(result);
      };

      request.onerror = () => reject(request.error);
    });
  }

  saveSettings(settings) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put(settings, 'shop_config');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // --- PRODUCTS OPERATIONS ---
  getProducts() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['products'], 'readonly');
      const store = transaction.objectStore('products');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  getProductById(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['products'], 'readonly');
      const store = transaction.objectStore('products');
      const request = store.get(Number(id));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  getProductByBarcode(barcode) {
    return new Promise((resolve, reject) => {
      if (!barcode) return resolve(null);
      const transaction = this.db.transaction(['products'], 'readonly');
      const store = transaction.objectStore('products');
      const index = store.index('barcode');
      const request = index.get(barcode.trim());

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  saveProduct(product) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['products'], 'readwrite');
      const store = transaction.objectStore('products');
      
      // Ensure numerical values are correctly typed
      const formattedProduct = {
        ...product,
        rate: Number(product.rate) || 0,
        discount: Number(product.discount) || 0,
        gst: Number(product.gst) || 0,
        stock: product.stock !== undefined ? Number(product.stock) : 0
      };

      const request = store.put(formattedProduct);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  deleteProduct(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['products'], 'readwrite');
      const store = transaction.objectStore('products');
      const request = store.delete(Number(id));

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // --- INVOICE OPERATIONS ---
  getInvoices() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['invoices'], 'readonly');
      const store = transaction.objectStore('invoices');
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort invoices: newest first
        const list = request.result || [];
        list.sort((a, b) => new Date(b.date + 'T' + b.time) - new Date(a.date + 'T' + a.time));
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  }

  getInvoiceById(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['invoices'], 'readonly');
      const store = transaction.objectStore('invoices');
      const request = store.get(Number(id));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  getInvoiceByNumber(invoiceNumber) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['invoices'], 'readonly');
      const store = transaction.objectStore('invoices');
      const index = store.index('invoiceNumber');
      const request = index.get(invoiceNumber);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  saveInvoice(invoice) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['invoices'], 'readwrite');
      const store = transaction.objectStore('invoices');
      const request = store.put(invoice);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  deleteInvoice(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['invoices'], 'readwrite');
      const store = transaction.objectStore('invoices');
      const request = store.delete(Number(id));

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // --- DATABASE RESET / RESTORE ---
  clearAll() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings', 'products', 'invoices'], 'readwrite');
      const settingsStore = transaction.objectStore('settings');
      const productsStore = transaction.objectStore('products');
      const invoicesStore = transaction.objectStore('invoices');

      settingsStore.clear();
      productsStore.clear();
      invoicesStore.clear();

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Import entire backup JSON
  importBackup(backupData) {
    return new Promise(async (resolve, reject) => {
      try {
        const transaction = this.db.transaction(['settings', 'products', 'invoices'], 'readwrite');
        
        if (backupData.settings) {
          const settingsStore = transaction.objectStore('settings');
          settingsStore.put(backupData.settings, 'shop_config');
        }

        if (backupData.products && Array.isArray(backupData.products)) {
          const productsStore = transaction.objectStore('products');
          productsStore.clear(); // Clear existing products
          for (const prod of backupData.products) {
            delete prod.id; // Strip old ids to allow auto-increment to handle
            productsStore.add(prod);
          }
        }

        if (backupData.invoices && Array.isArray(backupData.invoices)) {
          const invoicesStore = transaction.objectStore('invoices');
          invoicesStore.clear(); // Clear existing invoices
          for (const inv of backupData.invoices) {
            delete inv.id;
            invoicesStore.add(inv);
          }
        }

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = (event) => reject(event.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }
}

const dbInstance = new AppDB();
export default dbInstance;
