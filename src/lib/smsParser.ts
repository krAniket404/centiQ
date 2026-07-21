export interface ParsedTransaction {
  id?: string;
  amount: number;
  date: Date;
  bank: string;
  raw: string;
  type: 'debit' | 'credit';
  merchant: string;
}

export function parseBankSMS(smsBody: string, smsDate: number): ParsedTransaction | null {
  let amount = 0;
  let bank = 'Unknown';
  let type: 'debit' | 'credit' | null = null;
  let merchant = 'Unknown';

  const upperBody = smsBody.toUpperCase();

  // 1. Determine Transaction Type (Credit vs Debit)
  const creditKeywords = ['CREDITED', 'RECEIVED', 'REFUND', 'ADDED', 'DEPOSITED', 'REVERSAL'];
  const debitKeywords = ['DEBITED', 'SPENT', 'PAID', 'PURCHASE', 'WITHDRAWN', 'SENT', 'DEDUCTED'];

  if (creditKeywords.some(kw => upperBody.includes(kw))) {
    type = 'credit';
  } else if (debitKeywords.some(kw => upperBody.includes(kw))) {
    type = 'debit';
  } else {
    return null; // If it doesn't have a clear transaction keyword, ignore it
  }

  // 2. Extract Amount
  const amountRegex = /(?:Rs\.?|INR|₹)\s?([\d,]+\.?\d*)/i;
  const match = smsBody.match(amountRegex);
  if (match && match[1]) {
    amount = parseFloat(match[1].replace(/,/g, ''));
  } else {
    return null;
  }

  // 3. Extract Merchant (Who was paid?)
  // Looks for "at MERCHANT", "to MERCHANT", "via MERCHANT" and grabs the next 1-3 words
  const merchantRegex = /(?:at|to|via|from)\s+([A-Za-z0-9\s&'-]{3,20})/i;
  const merchantMatch = smsBody.match(merchantRegex);
  if (merchantMatch && merchantMatch[1]) {
    // Clean up the merchant name (remove trailing words like "on", "ref", etc.)
    merchant = merchantMatch[1].trim().split(' ').slice(0, 2).join(' ');
    merchant = merchant.toUpperCase();
  }

  // 4. Identify Bank
  if (upperBody.includes('HDFC')) bank = 'HDFC';
  else if (upperBody.includes('SBI')) bank = 'SBI';
  else if (upperBody.includes('ICICI')) bank = 'ICICI';
  else if (upperBody.includes('AXIS')) bank = 'AXIS';
  else if (upperBody.includes('KOTAK')) bank = 'KOTAK';
  else if (upperBody.includes('ONEPLUS')) bank = 'OnePlus';

  const date = new Date(smsDate);

  return {
    amount,
    date,
    bank,
    raw: smsBody,
    type,
    merchant
  };
}