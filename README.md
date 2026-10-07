# Vardhman Billing Desk

GST billing, inventory and customer-dues software for a furniture & electronics shop. It runs in the browser, works offline, and keeps data on the device (IndexedDB). Cloud sync through Supabase is optional.

## Features

- **Secure login.** On first run you create an owner (admin) account. Passwords are hashed with PBKDF2-SHA256. Sessions can be remembered for 7 days, and an account locks for 60 s after 5 failed attempts.
  - **Forgot password:** use the one-time recovery code shown when the owner account was created. A new code is issued after every reset.
  - **Users & roles:** the admin can add staff accounts, reset their passwords, disable them or delete them. Staff can bill, record payments and view customers. Only admins can change settings, see reports, edit products or delete invoices.
  - **Cloud account (optional):** email/password sign-in, sign-up and password-reset email through Supabase.
- **Billing.** Barcode scanning (F2), product autocomplete, item discounts (% or Rs.), freight and extra discount. CGST+SGST or IGST is chosen automatically from the shop's state versus the place of supply (all Indian states). Round-off, amount in words, draft autosave, `Ctrl+S` to save, `Alt+N` for a new row.
- **Payments & dues.** Record amount received (partial or on credit) and later payments. Paid/Partial/Unpaid status, balance due, WhatsApp payment reminders.
- **Customers.** Customer directory built automatically from invoices: total billed, outstanding, purchase history, auto-fill when a returning customer's mobile is typed.
- **Inventory.** Product master with category, purchase rate, low-stock alerts, stock adjustments and Excel import/export. Stock is deducted on billing and restored when an invoice is edited or deleted.
- **Invoices.** Tally-style print layout and PDF download. Search plus date, status and payment-mode filters, edit, duplicate, share on WhatsApp, Excel export.
- **Reports.** Daily and monthly sales, customer leaderboard, product revenue, GST invoice register (B2B/B2C, CGST/SGST/IGST), HSN summary for GSTR-1, payment-mode collections. Any date range, exportable to Excel.
- **Backup.** JSON export/restore of all shop data.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. On first launch you are asked to create the owner account. **Write down the recovery code** that is shown afterwards.

Production build: `npm run build` (output in `dist/`, served with `npm run preview`).

## Optional cloud sync (Supabase)

1. Create a project at https://supabase.com.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the project's SQL editor.
3. Create a `.env` file (never commit it):

   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon public key>
   ```

4. Restart `npm run dev`. A **Cloud Account** tab appears on the login screen.

Without `.env` the app runs fully offline with local accounts.

## Data & security notes

- Local data lives in the browser profile on that device. Clearing site data erases it, so export a backup regularly (Settings → Export DB Backup).
- Local accounts protect the app UI on a shared counter PC. They do not encrypt the browser's stored data from someone with access to the Windows user profile.
