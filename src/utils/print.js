import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import { convertNumberToWords } from './numbers';

class PrintModule {
  // --- NATIVE PRINT TRIGGERING ---
  printInvoice(invoice) {
    this.preparePrintContainer(invoice);

    // Preload static QR code image to guarantee it is visible in the print preview
    const qrImg = new Image();
    qrImg.onload = () => {
      setTimeout(() => {
        window.print();
      }, 100);
    };
    qrImg.onerror = () => {
      // Print anyway if load fails
      window.print();
    };
    qrImg.src = 'assets/my-qr.jpeg';
  }

  preparePrintContainer(invoice) {
    let container = document.getElementById('global-print-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'global-print-container';
      container.className = 'print-container';
      document.body.appendChild(container);
    }

    const shop = invoice.shopConfig || {};
    const formattedDate = new Date(invoice.date).toLocaleDateString('en-GB');

    container.innerHTML = `
      <div style="display:block; font-family: 'Arial', sans-serif; font-size: 10.5px; color: #000; line-height: 1.35; width: 100%; box-sizing: border-box; background: #fff;">
        
        <div style="text-align: center; font-weight: 800; font-size: 15px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Tax Invoice</div>
        
        <table style="width: 100%; border: 1.5px solid #000; border-collapse: collapse; margin-bottom: 0;">
          <!-- Seller & Invoice Metadata Grid -->
          <tr>
            <td style="width: 50%; border: 1px solid #000; padding: 6px; vertical-align: top; height: 130px; line-height: 1.4;">
              <div style="font-weight: bold; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; color: #1e3a8a;">${shop.shopName || 'Vardhman Furniture House and Electronics'}</div>
              <div>${shop.address || ''}</div>
              <div style="margin-top: 4px;"><strong>GSTIN/UIN:</strong> ${shop.gstNumber || ''}</div>
              <div><strong>State Name:</strong> ${shop.state || 'Uttar Pradesh'}, <strong>Code:</strong> ${this.getStateCode(shop.state || 'Uttar Pradesh')}</div>
              ${shop.mobile ? `<div><strong>Contact Mobile:</strong> ${shop.mobile}</div>` : ''}
            </td>
            <td style="width: 50%; border: 1px solid #000; padding: 0; vertical-align: top; height: 130px;">
              <table style="width: 100%; border-collapse: collapse; height: 100%; font-size: 10.5px;">
                <tr>
                  <td style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 4px; width: 50%; vertical-align: top;">
                    <span style="font-size: 8px; color: #555; display:block; font-weight: 600;">Invoice No.</span>
                    <span><strong>${invoice.invoiceNumber}</strong></span>
                  </td>
                  <td style="border-bottom: 1px solid #000; padding: 4px; width: 50%; vertical-align: top;">
                    <span style="font-size: 8px; color: #555; display:block; font-weight: 600;">Dated</span>
                    <span><strong>${formattedDate}</strong></span>
                  </td>
                </tr>
                <tr>
                  <td style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 4px; vertical-align: top;">
                    <span style="font-size: 8px; color: #555; display:block; font-weight: 600;">Delivery Note</span>
                    <span>${invoice.deliveryNote || '&nbsp;'}</span>
                  </td>
                  <td style="border-bottom: 1px solid #000; padding: 4px; vertical-align: top;">
                    <span style="font-size: 8px; color: #555; display:block; font-weight: 600;">Mode/Terms of Payment</span>
                    <span><strong>${invoice.paymentMode || 'Cash'}</strong></span>
                  </td>
                </tr>
                <tr>
                  <td style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 4px; vertical-align: top;">
                    <span style="font-size: 8px; color: #555; display:block; font-weight: 600;">Supplier's Ref.</span>
                    <span>${invoice.refNo || '&nbsp;'}</span>
                  </td>
                  <td style="border-bottom: 1px solid #000; padding: 4px; vertical-align: top;">
                    <span style="font-size: 8px; color: #555; display:block; font-weight: 600;">Other Reference(s)</span>
                    <span>&nbsp;</span>
                  </td>
                </tr>
                <tr>
                  <td style="border-right: 1px solid #000; padding: 4px; vertical-align: top;">
                    <span style="font-size: 8px; color: #555; display:block; font-weight: 600;">Buyer's Order No.</span>
                    <span>${invoice.orderNo || '&nbsp;'}</span>
                  </td>
                  <td style="padding: 4px; vertical-align: top;">
                    <span style="font-size: 8px; color: #555; display:block; font-weight: 600;">Dated</span>
                    <span>&nbsp;</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Buyer details and dispatch grid -->
          <tr>
            <td style="width: 50%; border: 1px solid #000; padding: 6px; vertical-align: top; height: 110px; line-height: 1.4;">
              <span style="font-size: 8px; color: #555; display:block; font-weight: 600;">Buyer (Bill To)</span>
              <div style="font-weight: bold; font-size: 11px;">${invoice.customerName || 'Walk-in Customer'}</div>
              ${invoice.customerAddress ? `<div>${invoice.customerAddress}</div>` : ''}
              ${invoice.customerMobile ? `<div><strong>Mobile:</strong> ${invoice.customerMobile}</div>` : ''}
              ${invoice.customerGstin ? `<div style="margin-top: 4px;"><strong>GSTIN/UIN:</strong> ${invoice.customerGstin}</div>` : ''}
              <div><strong>State Name:</strong> ${invoice.customerState || 'Uttar Pradesh'}, <strong>Code:</strong> ${this.getStateCode(invoice.customerState || 'Uttar Pradesh')}</div>
            </td>
            <td style="width: 50%; border: 1px solid #000; padding: 0; vertical-align: top; height: 110px;">
              <table style="width: 100%; border-collapse: collapse; height: 100%; font-size: 10.5px;">
                <tr>
                  <td style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 4px; width: 50%; vertical-align: top;">
                    <span style="font-size: 8px; color: #555; display:block; font-weight: 600;">Dispatch Document No.</span>
                    <span>&nbsp;</span>
                  </td>
                  <td style="border-bottom: 1px solid #000; padding: 4px; width: 50%; vertical-align: top;">
                    <span style="font-size: 8px; color: #555; display:block; font-weight: 600;">Delivery Note Date</span>
                    <span>&nbsp;</span>
                  </td>
                </tr>
                <tr>
                  <td style="border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 4px; vertical-align: top;">
                    <span style="font-size: 8px; color: #555; display:block; font-weight: 600;">Dispatched through</span>
                    <span>${invoice.dispatchThrough || '&nbsp;'}</span>
                  </td>
                  <td style="border-bottom: 1px solid #000; padding: 4px; vertical-align: top;">
                    <span style="font-size: 8px; color: #555; display:block; font-weight: 600;">Destination</span>
                    <span><strong>${invoice.destination || '&nbsp;'}</strong></span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px; vertical-align: top;" colspan="2">
                    <span style="font-size: 8px; color: #555; display:block; font-weight: 600;">Terms of Delivery</span>
                    <span>${invoice.termsDelivery || '&nbsp;'}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Items Table Grid (Dense Tally format) -->
        <table style="width: 100%; border: 1.5px solid #000; border-top: none; border-collapse: collapse; font-size: 10px; margin-bottom: 0;">
          <thead>
            <tr style="background-color: #f1f5f9; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
              <th style="border: 1px solid #000; padding: 5px; width: 5%; text-align: center; font-weight: 700;">Sl<br>No.</th>
              <th style="border: 1px solid #000; padding: 5px; width: 45%; text-align: left; font-weight: 700;">Description of Goods and Services</th>
              <th style="border: 1px solid #000; padding: 5px; width: 10%; text-align: center; font-weight: 700;">HSN/SAC</th>
              <th style="border: 1px solid #000; padding: 5px; width: 8%; text-align: center; font-weight: 700;">Quantity</th>
              <th style="border: 1px solid #000; padding: 5px; width: 10%; text-align: right; font-weight: 700;">Rate</th>
              <th style="border: 1px solid #000; padding: 5px; width: 5%; text-align: center; font-weight: 700;">per</th>
              <th style="border: 1px solid #000; padding: 5px; width: 8%; text-align: center; font-weight: 700;">Discount</th>
              <th style="border: 1px solid #000; padding: 5px; width: 12%; text-align: right; font-weight: 700;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <!-- Items Rows -->
            ${invoice.items.map((item, index) => {
              let displayName = item.name;
              return `
                <tr style="vertical-align: top; height: 26px;">
                  <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 4px; text-align: center;">${index + 1}</td>
                  <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 4px;">
                    <strong>${displayName}</strong>
                  </td>
                  <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 4px; text-align: center;">${item.hsn || '-'}</td>
                  <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 4px; text-align: center; font-weight: bold;">${item.qty} ${item.unit}</td>
                  <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 4px; text-align: right;">${item.rate.toFixed(2)}</td>
                  <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 4px; text-align: center;">${item.unit}</td>
                  <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 4px; text-align: center;">${item.discount > 0 ? (item.discountType === 'amount' ? '₹' + item.discount : item.discount + '%') : ''}</td>
                  <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 4px; text-align: right; font-weight: bold;">${item.taxableAmount.toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
            
            <!-- Padding empty rows to balance page size -->
            ${this.generateEmptyRows(invoice.items.length)}

            <!-- Subtotal Divider line -->
            <tr style="vertical-align: top; height: 18px;">
              <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
              <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px; text-align: right; font-weight: bold;"></td>
              <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
              <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
              <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
              <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
              <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
              <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px; text-align: right; border-top: 1px solid #000; font-weight: bold;">${invoice.subtotal.toFixed(2)}</td>
            </tr>

            <!-- Freight Line -->
            ${invoice.freight > 0 ? `
              <tr style="vertical-align: top; height: 18px;">
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px; text-align: right; font-weight: bold; font-style: italic;">Freight Out</td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px; text-align: center;">996511</td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px; text-align: right; font-weight: bold;">${invoice.freight.toFixed(2)}</td>
              </tr>
            ` : ''}

            <!-- Taxes Split Lines -->
            ${invoice.isLocal ? `
              <tr style="vertical-align: top; height: 18px;">
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px; text-align: right; font-weight: bold; font-style: italic;">CGST</td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px; text-align: right; font-weight: bold;">${invoice.cgstTotal.toFixed(2)}</td>
              </tr>
              <tr style="vertical-align: top; height: 18px;">
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px; text-align: right; font-weight: bold; font-style: italic;">SGST</td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px; text-align: right; font-weight: bold;">${invoice.sgstTotal.toFixed(2)}</td>
              </tr>
            ` : `
              <tr style="vertical-align: top; height: 18px;">
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px; text-align: right; font-weight: bold; font-style: italic;">IGST</td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px; text-align: right; font-weight: bold;">${invoice.igstTotal.toFixed(2)}</td>
              </tr>
            `}

            <!-- Extra Discount Line -->
            ${invoice.extraDiscount > 0 ? `
              <tr style="vertical-align: top; height: 18px;">
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px; text-align: right; font-weight: bold; color: #b91c1c; font-style: italic;">Less: Extra Cash Discount</td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
                <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px; text-align: right; font-weight: bold; color: #b91c1c;">- ${invoice.extraDiscount.toFixed(2)}</td>
              </tr>
            ` : ''}

            <!-- Rounding Line -->
            <tr style="vertical-align: top; height: 18px;">
              <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
              <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px; text-align: right; font-style: italic;">Rounding Off</td>
              <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
              <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
              <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
              <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
              <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px;"></td>
              <td style="border-left: 1px solid #000; border-right: 1px solid #000; padding: 2px; text-align: right;">${(invoice.roundOff >= 0 ? '+' : '')}${invoice.roundOff.toFixed(2)}</td>
            </tr>

            <!-- Table Totals row -->
            <tr style="border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; font-weight: bold; background-color: #f1f5f9;">
              <td style="border: 1px solid #000; padding: 5px;">&nbsp;</td>
              <td style="border: 1px solid #000; padding: 5px; text-align: right; font-weight: 700; text-transform: uppercase;">Total</td>
              <td style="border: 1px solid #000; padding: 5px;">&nbsp;</td>
              <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: 700;">${this.getSumQty(invoice.items)}</td>
              <td style="border: 1px solid #000; padding: 5px;">&nbsp;</td>
              <td style="border: 1px solid #000; padding: 5px;">&nbsp;</td>
              <td style="border: 1px solid #000; padding: 5px;">&nbsp;</td>
              <td style="border: 1px solid #000; padding: 5px; text-align: right; font-size: 11px; font-weight: 700;">₹ ${invoice.grandTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Amount Chargeable in words -->
        <div style="border: 1.5px solid #000; border-top: none; padding: 6px; font-size: 9.5px; display:flex; justify-content:space-between; line-height: 1.4;">
          <div>
            Amount Chargeable (in words):<br>
            <strong style="text-transform: uppercase; font-size:10px;">INR ${invoice.amountInWords}</strong>
          </div>
          <div style="font-style: italic; font-weight: bold; align-self: flex-end;">E. & O.E.</div>
        </div>

        <!-- HSN Summary Table -->
        <table style="width: 100%; border: 1.5px solid #000; border-top: none; border-collapse: collapse; font-size: 9px; text-align: center; margin-bottom: 0;">
          <thead>
            <tr style="background-color: #f1f5f9; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
              <th style="border: 1px solid #000; padding: 4px; font-weight: 700;" rowspan="2">HSN/SAC</th>
              <th style="border: 1px solid #000; padding: 4px; font-weight: 700;" rowspan="2">Taxable Value</th>
              ${invoice.isLocal ? `
                <th style="border: 1px solid #000; padding: 4px; font-weight: 700;" colspan="2">Central Tax</th>
                <th style="border: 1px solid #000; padding: 4px; font-weight: 700;" colspan="2">State Tax</th>
              ` : `
                <th style="border: 1px solid #000; padding: 4px; font-weight: 700;" colspan="2">Integrated Tax</th>
              `}
              <th style="border: 1px solid #000; padding: 4px; font-weight: 700;" rowspan="2">Total Tax Amount</th>
            </tr>
            <tr style="background-color: #f1f5f9; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
              <th style="border: 1px solid #000; padding: 2px; font-weight: 700;">Rate</th>
              <th style="border: 1px solid #000; padding: 2px; font-weight: 700;">Amount</th>
              ${invoice.isLocal ? `
                <th style="border: 1px solid #000; padding: 2px; font-weight: 700;">Rate</th>
                <th style="border: 1px solid #000; padding: 2px; font-weight: 700;">Amount</th>
              ` : ''}
            </tr>
          </thead>
          <tbody>
            ${this.generateGstSummaryTallyRows(invoice)}
          </tbody>
        </table>

        <!-- Tax Amount in words -->
        <div style="border: 1.5px solid #000; border-top: none; padding: 6px; font-size: 9px; line-height: 1.4;">
          Tax Amount (in words) : &nbsp; <strong style="text-transform: uppercase;">INR ${this.convertTaxToWords(invoice)}</strong>
        </div>

        <!-- PAN details, Decl and Signatures -->
        <table style="width: 100%; border: 1.5px solid #000; border-top: none; border-collapse: collapse; font-size: 9.5px; margin-bottom: 0;">
          <tr>
            <td style="width: 55%; border-right: 1px solid #000; padding: 6px; vertical-align: top; line-height: 1.4;">
              <div>Company's PAN &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; : <strong>${shop.gstNumber ? shop.gstNumber.substring(2, 12) : ''}</strong></div>
              
              <!-- Bank details row -->
              ${shop.bankAccount ? `
              <div style="margin-top: 8px; font-size: 9px; border-top: 1px dashed #bbb; padding-top: 4px; line-height: 1.3;">
                <strong>Bank Account Details for UPI/NEFT/RTGS payments:</strong><br>
                A/C Account Number: <strong>${shop.bankAccount}</strong> &nbsp; | &nbsp; IFSC Code: <strong>${shop.bankIfsc}</strong> &nbsp; | &nbsp; UPI ID: <strong>9907879457@hdfc</strong>
              </div>
              ` : ''}

              <div style="margin-top: 8px;">
                <span style="text-decoration: underline; font-weight: bold;">Declaration:</span><br>
                We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
              </div>
            </td>
            <td style="width: 45%; padding: 6px; vertical-align: top; text-align: center; height: 110px;">
              <div style="font-size: 8.5px; margin-bottom: 40px;">for <strong>${shop.shopName || 'VARDHMAN FURNITURE HOUSE AND ELECTRONICS'}</strong></div>
              <div style="margin-top: auto;">
                ${shop.proprietor ? `<div style="font-weight: bold; font-size: 10px; margin-bottom: 2px;">${shop.proprietor}</div>` : ''}
                <span style="border-top: 1px dashed #000; padding-top: 2px; display: inline-block; width: 80%; font-size: 8.5px;">Proprietor / Authorised Signatory</span>
              </div>
            </td>
          </tr>
        </table>

        <div style="text-align: center; font-size: 8px; margin-top: 5px; color: #555; font-style: italic;">This is a Computer Generated Invoice</div>
      </div>

      <!-- Print layout barcodes hidden by default on screen -->
      <div class="print-barcodes-section" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #000; margin-top: 15px; padding-top: 10px;">
        <div class="barcode-wrapper" style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
          <span style="font-size: 8px; font-weight: 600;">Invoice Barcode</span>
          <svg class="print-barcode-svg" id="print-barcode-svg-invoice"></svg>
        </div>
        <div class="barcode-wrapper" id="qr-container-el" style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding-right: 15px;">
          <span style="font-size: 8px; font-weight: 600;">Scan to Pay QR</span>
          <img src="assets/my-qr.jpeg" style="width: 55px; height: 55px; object-fit: contain;">
        </div>
      </div>
    `;

    // Generate Invoice Barcode
    JsBarcode("#print-barcode-svg-invoice", invoice.invoiceNumber, {
      format: "CODE128",
      width: 1.5,
      height: 35,
      displayValue: true,
      fontSize: 9,
      margin: 0
    });
  }

  // --- TALLY HELPERS ---
  getStateCode(state) {
    const codes = {
      'Delhi': '07',
      'Haryana': '06',
      'Punjab': '03',
      'Rajasthan': '08',
      'Uttar Pradesh': '09',
      'Madhya Pradesh': '23',
      'Himachal Pradesh': '02',
      'Uttarakhand': '05',
      'Bihar': '10',
      'Gujarat': '24',
      'Maharashtra': '27',
      'Karnataka': '29'
    };
    return codes[state] || '09';
  }

  generateEmptyRows(length) {
    const minRows = 6;
    if (length >= minRows) return '';
    let html = '';
    for (let i = 0; i < (minRows - length); i++) {
      html += `
        <tr style="height: 25px;">
          <td style="border-left: 1px solid #000; border-right: 1px solid #000;">&nbsp;</td>
          <td style="border-left: 1px solid #000; border-right: 1px solid #000;">&nbsp;</td>
          <td style="border-left: 1px solid #000; border-right: 1px solid #000;">&nbsp;</td>
          <td style="border-left: 1px solid #000; border-right: 1px solid #000;">&nbsp;</td>
          <td style="border-left: 1px solid #000; border-right: 1px solid #000;">&nbsp;</td>
          <td style="border-left: 1px solid #000; border-right: 1px solid #000;">&nbsp;</td>
          <td style="border-left: 1px solid #000; border-right: 1px solid #000;">&nbsp;</td>
          <td style="border-left: 1px solid #000; border-right: 1px solid #000;">&nbsp;</td>
        </tr>
      `;
    }
    return html;
  }

  getSumQty(items) {
    return items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
  }

  generateGstSummaryTallyRows(invoice) {
    const gstGroups = {};
    invoice.items.forEach(item => {
      const hsn = item.hsn || '-';
      const rate = item.gst;
      if (!gstGroups[hsn]) {
        gstGroups[hsn] = { hsn, taxable: 0, taxRate: rate, taxAmt: 0 };
      }
      gstGroups[hsn].taxable += item.taxableAmount;
      gstGroups[hsn].taxAmt += ((item.cgst || 0) + (item.sgst || 0));
    });

    // Add freight if > 0
    if (invoice.freight > 0) {
      const fHsn = '996511';
      const fRate = invoice.freightGst || 18;
      const fTax = invoice.freight * (fRate / 100);
      if (!gstGroups[fHsn]) {
        gstGroups[fHsn] = { hsn: fHsn, taxable: 0, taxRate: fRate, taxAmt: 0 };
      }
      gstGroups[fHsn].taxable += invoice.freight;
      gstGroups[fHsn].taxAmt += fTax;
    }

    let totalTaxable = 0;
    let totalTax = 0;

    const rowsHtml = Object.values(gstGroups).map(g => {
      totalTaxable += g.taxable;
      totalTax += g.taxAmt;

      if (invoice.isLocal) {
        return `
          <tr>
            <td style="border: 1px solid #000; padding: 4px; font-weight: bold;">${g.hsn}</td>
            <td style="border: 1px solid #000; padding: 4px;">${g.taxable.toFixed(2)}</td>
            <td style="border: 1px solid #000; padding: 4px;">${(g.taxRate / 2)}%</td>
            <td style="border: 1px solid #000; padding: 4px;">${(g.taxAmt / 2).toFixed(2)}</td>
            <td style="border: 1px solid #000; padding: 4px;">${(g.taxRate / 2)}%</td>
            <td style="border: 1px solid #000; padding: 4px;">${(g.taxAmt / 2).toFixed(2)}</td>
            <td style="border: 1px solid #000; padding: 4px; font-weight: bold;">${g.taxAmt.toFixed(2)}</td>
          </tr>
        `;
      } else {
        return `
          <tr>
            <td style="border: 1px solid #000; padding: 4px; font-weight: bold;">${g.hsn}</td>
            <td style="border: 1px solid #000; padding: 4px;">${g.taxable.toFixed(2)}</td>
            <td style="border: 1px solid #000; padding: 4px;">${g.taxRate}%</td>
            <td style="border: 1px solid #000; padding: 4px;">${g.taxAmt.toFixed(2)}</td>
            <td style="border: 1px solid #000; padding: 4px; font-weight: bold;">${g.taxAmt.toFixed(2)}</td>
          </tr>
        `;
      }
    }).join('');

    const colSpan = invoice.isLocal ? 4 : 2;
    return rowsHtml + `
      <tr style="font-weight: bold; background-color: #f1f5f9;">
        <td style="border: 1px solid #000; padding: 4px; text-align: right;">Total</td>
        <td style="border: 1px solid #000; padding: 4px;">${totalTaxable.toFixed(2)}</td>
        <td style="border: 1px solid #000; padding: 4px;" colspan="${colSpan}">&nbsp;</td>
        <td style="border: 1px solid #000; padding: 4px;">${totalTax.toFixed(2)}</td>
      </tr>
    `;
  }

  convertTaxToWords(invoice) {
    const isLocal = invoice.isLocal !== undefined ? invoice.isLocal : (invoice.customerState === 'Uttar Pradesh' || !invoice.customerState);
    const taxVal = isLocal ? ((invoice.cgstTotal || 0) + (invoice.sgstTotal || 0)) : (invoice.igstTotal !== undefined ? invoice.igstTotal : ((invoice.cgstTotal || 0) + (invoice.sgstTotal || 0)));
    return convertNumberToWords(taxVal);
  }

  // --- PROGRAMMATIC PDF GENERATION (JSPDF) ---
  saveInvoiceAsPDF(invoice) {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const shop = invoice.shopConfig || {};

      // Draw outer box
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.rect(5, 5, 200, 287); // Boundary box

      // Title Section
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(shop.shopName || 'Vardhman Furniture House', 10, 15);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(shop.address || '', 10, 20);
      doc.text(`Mobile: ${shop.mobile || ''} | GSTIN: ${shop.gstNumber || ''}`, 10, 24);

      // Invoice metadata
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('TAX INVOICE', 140, 15);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Invoice No: ${invoice.invoiceNumber}`, 140, 20);
      doc.text(`Date: ${new Date(invoice.date).toLocaleDateString('en-GB')}`, 140, 24);
      doc.text(`Time: ${invoice.time} | Mode: ${invoice.paymentMode}`, 140, 28);

      // Section divider line
      doc.line(5, 33, 205, 33);

      // Bill To details
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('Buyer (Bill To):', 10, 38);
      doc.setFont('Helvetica', 'normal');
      doc.text(invoice.customerName || 'Walk-in Customer', 10, 42);
      if (invoice.customerAddress) doc.text(invoice.customerAddress, 10, 46);
      doc.text(`State Name: ${invoice.customerState || 'Uttar Pradesh'}`, 10, 50);
      if (invoice.customerMobile) doc.text(`Contact: ${invoice.customerMobile}`, 10, 54);
      if (invoice.customerGstin) doc.text(`GSTIN/UIN: ${invoice.customerGstin}`, 70, 54);

      // Draw table header box
      doc.rect(5, 58, 200, 7, 'S');

      doc.text('Sl.', 7, 63);
      doc.text('Product Name', 16, 63);
      doc.text('HSN', 82, 63);
      doc.text('Rate', 100, 63);
      doc.text('Qty', 118, 63);
      doc.text('Gross', 130, 63);
      doc.text('Disc', 148, 63);
      doc.text('Taxable', 158, 63);
      doc.text('GST%', 176, 63);
      doc.text('GST Amt', 186, 63);
      doc.text('Total', 198, 63, { align: 'right' });

      // Draw item rows
      let y = 65;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);

      invoice.items.forEach((item, index) => {
        y += 6;
        let displayName = item.name;
        if (displayName.length > 32) displayName = displayName.substring(0, 30) + '..';

        doc.text(String(index + 1), 7, y);
        doc.text(displayName, 16, y);
        doc.text(item.hsn || '-', 82, y);
        doc.text(item.rate.toFixed(2), 100, y);
        doc.text(`${item.qty} ${item.unit || 'PCS'}`, 118, y);
        doc.text((item.qty * item.rate).toFixed(2), 130, y);
        const discText = item.discount > 0 ? (item.discountType === 'amount' ? `₹${item.discount}` : `${item.discount}%`) : '-';
        doc.text(discText, 148, y);
        doc.text(item.taxableAmount.toFixed(2), 158, y);
        doc.text(`${item.gst}%`, 176, y);
        doc.text(((item.cgst || 0) + (item.sgst || 0)).toFixed(2), 186, y);
        doc.text(item.total.toFixed(2), 198, y, { align: 'right' });

        // Row dividers
        doc.setDrawColor(220, 220, 220);
        doc.line(5, y + 2, 205, y + 2);
        doc.setDrawColor(0);
      });

      y += 8;
      doc.line(5, y, 205, y); // Bold divider

      // Word details and Totals box
      y += 5;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Amount in Words:', 10, y);
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.text(invoice.amountInWords, 10, y + 4);

      // Calculations details
      let subY = y;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Subtotal:`, 140, subY);
      doc.text(`₹${(invoice.subtotal || 0).toFixed(2)}`, 198, subY, { align: 'right' });

      subY += 4;
      doc.text(`Discount:`, 140, subY);
      doc.text(`₹${(invoice.discountTotal || 0).toFixed(2)}`, 198, subY, { align: 'right' });

      if (invoice.freight > 0) {
        subY += 4;
        doc.text(`Freight Out:`, 140, subY);
        doc.text(`₹${(invoice.freight || 0).toFixed(2)}`, 198, subY, { align: 'right' });
      }

      const isLocal = invoice.isLocal !== undefined ? invoice.isLocal : (invoice.customerState === 'Uttar Pradesh' || !invoice.customerState);

      if (isLocal) {
        subY += 4;
        doc.text(`CGST:`, 140, subY);
        doc.text(`₹${(invoice.cgstTotal || 0).toFixed(2)}`, 198, subY, { align: 'right' });

        subY += 4;
        doc.text(`SGST:`, 140, subY);
        doc.text(`₹${(invoice.sgstTotal || 0).toFixed(2)}`, 198, subY, { align: 'right' });
      } else {
        const igstVal = invoice.igstTotal !== undefined ? invoice.igstTotal : ((invoice.cgstTotal || 0) + (invoice.sgstTotal || 0));
        subY += 4;
        doc.text(`IGST:`, 140, subY);
        doc.text(`₹${(igstVal || 0).toFixed(2)}`, 198, subY, { align: 'right' });
      }

      if (invoice.extraDiscount > 0) {
        subY += 4;
        doc.text(`Extra Discount:`, 140, subY);
        doc.text(`-₹${invoice.extraDiscount.toFixed(2)}`, 198, subY, { align: 'right' });
      }

      subY += 4;
      doc.text(`Round Off:`, 140, subY);
      const rOff = invoice.roundOff || 0;
      doc.text(`${rOff >= 0 ? '+' : ''}₹${rOff.toFixed(2)}`, 198, subY, { align: 'right' });

      subY += 5;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`GRAND TOTAL:`, 140, subY);
      doc.text(`₹${(invoice.grandTotal || 0).toFixed(2)}`, 198, subY, { align: 'right' });

      y = subY + 8;
      doc.line(5, y, 205, y); // Divider

      // Terms & Signature
      y += 5;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('Terms & Conditions:', 10, y);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      
      const terms = invoice.termsAndConditions || '';
      const termLines = doc.splitTextToSize(terms, 105);
      doc.text(termLines, 10, y + 4);

      // Bank account particulars
      if (shop.bankAccount) {
        const bankY = y + 25;
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('Bank Account Details:', 10, bankY);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(`Account No: ${shop.bankAccount}`, 10, bankY + 4);
        doc.text(`IFSC Code: ${shop.bankIfsc}`, 10, bankY + 8);
        doc.text(`Proprietor: ${shop.proprietor}`, 10, bankY + 12);
      }

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`For ${shop.shopName || 'Vardhman Furniture House'}`, 140, y + 2);
      if (shop.proprietor) {
        doc.setFont('Helvetica', 'bold');
        doc.text(shop.proprietor, 140, y + 13);
        doc.setFont('Helvetica', 'normal');
      }
      doc.line(140, y + 15, 195, y + 15);
      doc.text('Proprietor / Auth. Signatory', 142, y + 19);

      // Render barcode image dynamically onto the PDF canvas
      const barcodeCanvas = document.createElement('canvas');
      JsBarcode(barcodeCanvas, invoice.invoiceNumber, {
        format: "CODE128",
        width: 2,
        height: 40,
        displayValue: false
      });
      const barcodeImgData = barcodeCanvas.toDataURL("image/png");
      doc.addImage(barcodeImgData, 'PNG', 10, y + 22, 50, 10);
      doc.setFontSize(7);
      doc.text(invoice.invoiceNumber, 22, y + 35);

      // Try to load static QR Code and add to PDF, otherwise save immediately
      const qrImg = new Image();
      qrImg.onload = () => {
        try {
          const qrCanvas = document.createElement('canvas');
          qrCanvas.width = qrImg.width;
          qrCanvas.height = qrImg.height;
          const qrCtx = qrCanvas.getContext('2d');
          qrCtx.drawImage(qrImg, 0, 0);
          const qrDataUrl = qrCanvas.toDataURL('image/jpeg');
          
          doc.setFontSize(7.5);
          doc.setFont('Helvetica', 'bold');
          doc.text('Scan to Pay QR', 110, y + 21);
          doc.addImage(qrDataUrl, 'JPEG', 110, y + 23, 23, 23);
        } catch (e) {
          console.warn('Failed to embed static QR image in PDF:', e);
        }
        doc.save(`VFH_Invoice_${invoice.invoiceNumber}.pdf`);
        window.Toast.success('PDF downloaded successfully.');
      };
      qrImg.onerror = () => {
        doc.save(`VFH_Invoice_${invoice.invoiceNumber}.pdf`);
        window.Toast.success('PDF downloaded successfully.');
      };
      qrImg.src = 'assets/my-qr.jpeg';
    } catch (err) {
      console.error('jsPDF generation failed:', err);
      window.Toast.error('Failed to generate PDF document.');
    }
  }
}

const printModule = new PrintModule();
export default printModule;
