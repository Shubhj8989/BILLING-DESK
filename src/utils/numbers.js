export function convertNumberToWords(amount) {
  if (amount === 0) return 'Rupees Zero Only';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 
                 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const convertLessThanThousand = (num) => {
    if (num === 0) return '';
    let str = '';
    if (num >= 100) {
      str += units[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 20) {
      str += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    }
    if (num > 0) {
      str += units[num] + ' ';
    }
    return str.trim();
  };

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let wordStr = '';

  const lakhs = Math.floor(rupees / 100000);
  let rem = rupees % 100000;
  const thousands = Math.floor(rem / 1000);
  rem = rem % 1000;

  if (lakhs > 0) {
    wordStr += convertLessThanThousand(lakhs) + ' Lakh ';
  }
  if (thousands > 0) {
    wordStr += convertLessThanThousand(thousands) + ' Thousand ';
  }
  if (rem > 0) {
    wordStr += convertLessThanThousand(rem) + ' ';
  }

  wordStr = wordStr.trim() ? wordStr.trim() + ' Rupees' : '';

  let paiseStr = '';
  if (paise > 0) {
    paiseStr = convertLessThanThousand(paise) + ' Paise';
  }

  let finalWords = '';
  if (wordStr && paiseStr) {
    finalWords = `${wordStr} and ${paiseStr} Only`;
  } else if (wordStr) {
    finalWords = `${wordStr} Only`;
  } else if (paiseStr) {
    finalWords = `${paiseStr} Only`;
  } else {
    finalWords = 'Rupees Zero Only';
  }

  return finalWords;
}
