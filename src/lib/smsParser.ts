export interface ParsedTransaction {
  id?: string;
  amount: number;
  date: Date;
  bank: string;
  raw: string;
  type: 'debit' | 'credit';
  merchant: string;
  category?: string;
}

export function parseBankSMS(smsBody: string, smsDate: number): ParsedTransaction | null {
  let amount = 0;
  let bank = 'Bank Transfer';
  let type: 'debit' | 'credit' | null = null;
  let merchant = '';

  const upperBody = smsBody.toUpperCase();

  // 1. SPAM FILTER: Reject promotional messages and internal wallet credits
  const spamKeywords = [
    'OFFER', 'CASHBACK', 'WIN', 'COUPON', 'DISCOUNT', 'DEAL', 'APPLY', 'PROMO',
    'CLICK HERE', 'SHOP NOW', 'SUBSCRIBE', 'DATA PACK', 'TOLL FREE',
    'WALLET', 'CASH CREDITED', 'REWARD', 'POINTS CREDITED', 'GIFT CARD', 'STORE CREDIT',
    'JIO', 'PREPAID', 'POSTPAID', 'RECHARGE' // Added Jio/Recharge spam
  ];
  if (spamKeywords.some(kw => upperBody.includes(kw))) return null;

  // 2. Determine Transaction Type
  const creditKeywords = ['CREDITED', 'RECEIVED', 'REFUND', 'ADDED', 'DEPOSITED', 'REVERSAL'];
  const debitKeywords = ['DEBITED', 'SPENT', 'PAID', 'PURCHASE', 'WITHDRAWN', 'SENT', 'DEDUCTED'];

  if (creditKeywords.some(kw => upperBody.includes(kw))) type = 'credit';
  else if (debitKeywords.some(kw => upperBody.includes(kw))) type = 'debit';
  else return null;

  // 3. Extract Amount
  const amountRegex = /(?:Rs\.?|INR|₹)\s?([\d,]+\.?\d*)/i;
  const match = smsBody.match(amountRegex);
  if (match && match[1]) {
    amount = parseFloat(match[1].replace(/,/g, ''));
    if (amount <= 0) return null;
  } else {
    return null;
  }

  // 4. Extract Merchant / Person Name
  if (type === 'credit') {
    const vpaRegex = /(?:from|by|via)\s+([A-Za-z0-9\s&'-]+)@[a-z]+/i;
    const vpaMatch = smsBody.match(vpaRegex);
    if (vpaMatch && vpaMatch[1]) {
      let vpaName = vpaMatch[1].trim().toUpperCase();
      merchant = /^\d+$/.test(vpaName) ? 'VPA Transfer' : vpaName;
    } else {
      // Allow periods for initials, stop at RRN, Avl Bal, numbers, etc.
      const fromRegex = /(?:from|by|via)\s+([A-Za-z\s&'\.]+?)(?=\s(?:on|ref|via|for|avbl|towards|upi|a\/c|account|using|from|by|balance|info|your|rrn)\b|[0-9]|\.\s*(?:RRN|Avl|Not))/i;
      const fromMatch = smsBody.match(fromRegex);
      if (fromMatch && fromMatch[1]) {
        merchant = fromMatch[1].trim().toUpperCase();
      }
    }
  } else {
    const vpaRegex = /(?:to|at|via)\s+([A-Za-z0-9\s&'-]+)@[a-z]+/i;
    const vpaMatch = smsBody.match(vpaRegex);
    if (vpaMatch && vpaMatch[1]) {
      let vpaName = vpaMatch[1].trim().toUpperCase();
      merchant = /^\d+$/.test(vpaName) ? 'VPA Transfer' : vpaName;
    } else {
      // Allow periods, stop at RRN, Avl Bal, numbers, etc.
      const toRegex = /(?:to|at|via)\s+([A-Za-z\s&'\.]+?)(?=\s(?:on|ref|via|for|avbl|towards|upi|a\/c|account|using|from|by|balance|info|your|rrn)\b|[0-9]|\.\s*(?:RRN|Avl|Not))/i;
      const toMatch = smsBody.match(toRegex);
      if (toMatch && toMatch[1]) {
        merchant = toMatch[1].trim().toUpperCase();
      }
    }
  }

  // Clean up trailing periods and common garbage words
  merchant = merchant.replace(/\b(ON|REF|AVBL|VIA|UPI|YBL|OKAXIS|OKHDFCBANK|VPA|A\/C|ACCT|ACCOUNT|BAL|RRN)\b/g, '').trim();
  merchant = merchant.replace(/\.+$/, '').trim(); // Remove trailing periods

  if (merchant.length < 3) merchant = 'Unknown';

  // 5. Identify Bank
  if (upperBody.includes('HDFC')) bank = 'HDFC';
  else if (upperBody.includes('SBI')) bank = 'SBI';
  else if (upperBody.includes('ICICI')) bank = 'ICICI';
  else if (upperBody.includes('AXIS')) bank = 'AXIS';
  else if (upperBody.includes('KOTAK')) bank = 'KOTAK';
  else if (upperBody.includes('INDIAN BANK')) bank = 'Indian Bank';

  const date = new Date(smsDate);
  return { amount, date, bank, raw: smsBody, type, merchant };
}