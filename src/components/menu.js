// Navigation entries and which roles may open them
export const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'staff'] },
  { id: 'billing', label: 'Create Invoice', icon: '🧾', roles: ['admin', 'staff'] },
  { id: 'records', label: 'Invoice History', icon: '📂', roles: ['admin', 'staff'] },
  { id: 'customers', label: 'Customers & Dues', icon: '👥', roles: ['admin', 'staff'] },
  { id: 'products', label: 'Product Master', icon: '🛋️', roles: ['admin', 'staff'] },
  { id: 'reports', label: 'Reports', icon: '📈', roles: ['admin'] },
  { id: 'settings', label: 'Settings', icon: '⚙️', roles: ['admin', 'staff'] }
];
