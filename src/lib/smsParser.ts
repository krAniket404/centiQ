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
  let bank = 'Bank'; // Changed from 'Transaction'
  let type: 'debit' | 'credit' | null = null;
  let merchant = '';

  const upperBody = smsBody.toUpperCase();

  // 1. Transaction Type
  const creditKeywords = ['CREDITED', 'RECEIVED', 'REFUND', 'ADDED', 'DEPOSITED', 'REVERSAL'];
  const debitKeywords = ['DEBITED', 'SPENT', 'PAID', 'PURCHASE', 'WITHDRAWN', 'SENT', 'DEDUCTED'];
  if (creditKeywords.some(kw => upperBody.includes(kw))) type = 'credit';
  else if (debitKeywords.some(kw => upperBody.includes(kw))) type = 'debit';
  else return null;

  // 2. Extract Amount
  const amountRegex = /(?:Rs\.?|INR|₹)\s?([\d,]+\.?\d*)/i;
  const match = smsBody.match(amountRegex);
  if (match && match[1]) {
    amount = parseFloat(match[1].replace(/,/g, ''));
  } else return null;

  // 3. Extract Merchant / Sender based on Type
  if (type === 'credit') {
    const vpaRegex = /(?:from|by|via)\s+([A-Za-z0-9\s&'-]+)@[a-z]+/i;
    const vpaMatch = smsBody.match(vpaRegex);
    if (vpaMatch && vpaMatch[1]) {
      merchant = vpaMatch[1].trim().toUpperCase();
    } else {
      const fromRegex = /(?:from|by|via)\s+([A-Za-z0-9\s&'-]{3,40})/i; // Expanded to 40 chars
      const fromMatch = smsBody.match(fromRegex);
      if (fromMatch && fromMatch[1]) {
        merchant = fromMatch[1].trim().split(' ').slice(0, 3).join(' ').toUpperCase(); // Capture up to 3 words
      }
    }
  } else {
    const vpaRegex = /(?:to|at|via)\s+([A-Za-z0-9\s&'-]+)@[a-z]+/i;
    const vpaMatch = smsBody.match(vpaRegex);
    if (vpaMatch && vpaMatch[1]) {
      merchant = vpaMatch[1].trim().toUpperCase();
    } else {
      const toRegex = /(?:to|at|via)\s+([A-Za-z0-9\s&'-]{3,40})/i; // Expanded to 40 chars
      const toMatch = smsBody.match(toRegex);
      if (toMatch && toMatch[1]) {
        merchant = toMatch[1].trim().split(' ').slice(0, 3).join(' ').toUpperCase(); // Capture up to 3 words
      }
    }
  }

  // Clean up common garbage words
  merchant = merchant.replace(/\b(ON|REF|AVBL|VIA|UPI|YBL|OKAXIS|OKHDFCBANK|VPA|A\/C|ACCT|ACCOUNT|BAL)\b/g, '').trim();

  // Fallback if no name found
  if (merchant.length < 3) {
    merchant = type === 'credit' ? 'Income' : 'Merchant';
  }

  // 4. Identify Bank
  if (upperBody.includes('HDFC')) bank = 'HDFC';
  else if (upperBody.includes('SBI')) bank = 'SBI';
  else if (upperBody.includes('ICICI')) bank = 'ICICI';
  else if (upperBody.includes('AXIS')) bank = 'AXIS';
  else if (upperBody.includes('KOTAK')) bank = 'KOTAK';

  const date = new Date(smsDate);
  return { amount, date, bank, raw: smsBody, type, merchant };
}