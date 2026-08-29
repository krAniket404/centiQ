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

  // 1. SPAM FILTER: Reject promotional messages, wallet credits, and mandate warnings
  const spamKeywords = [
    'OFFER', 'CASHBACK', 'WIN', 'COUPON', 'DISCOUNT', 'DEAL', 'APPLY', 'PROMO',
    'CLICK HERE', 'SHOP NOW', 'SUBSCRIBE', 'DATA PACK', 'TOLL FREE',
    'WALLET', 'CASH CREDITED', 'REWARD', 'POINTS CREDITED', 'GIFT CARD', 'STORE CREDIT',
    'JIO', 'PREPAID', 'POSTPAID', 'RECHARGE',
    'WILL BE DEBITED', 'MANDATE', 'AUTOPAY', 'AUTO PAY', 'SIP', 'EXECUTED ON'
  ];
  if (spamKeywords.some(kw => upperBody.includes(kw))) return null;

  // 2. Determine Transaction Type (Added Dr. and Cr. for PSU banks like Canara/SBI)
  const creditKeywords = ['CREDITED', 'RECEIVED', 'REFUND', 'ADDED', 'DEPOSITED', 'REVERSAL', 'CR.', 'CR '];
  const debitKeywords = ['DEBITED', 'SPENT', 'PAID', 'PURCHASE', 'WITHDRAWN', 'SENT', 'DEDUCTED', 'DR.', 'DR '];

  if (creditKeywords.some(kw => upperBody.includes(kw))) type = 'credit';
  else if (debitKeywords.some(kw => upperBody.includes(kw))) type = 'debit';
  else return null;

  // 3. PRE-CLEAN: Remove the "Balance" part of the SMS so we don't accidentally grab the balance amount!
  // This splits the SMS at "Bal" or "Avl Bal" and only looks at the first half.
  const cleanBody = smsBody.split(/Avl Bal|Bal INR|Avl bal|Balance INR|Bal Rs/i)[0];

  // 4. Extract Amount
  const amountRegex = /(?:Rs\.?|INR|₹)\s?([\d,]+\.?\d*)/i;
  const match = cleanBody.match(amountRegex);
  if (match && match[1]) {
    amount = parseFloat(match[1].replace(/,/g, ''));
    if (amount <= 0) return null;
  } else {
    return null;
  }

  // 5. Extract Merchant / Person Name
  if (type === 'credit') {
    const vpaRegex = /(?:from|by|via)\s+([A-Za-z0-9\s&'-]+)@[a-z]+/i;
    const vpaMatch = cleanBody.match(vpaRegex);
    if (vpaMatch && vpaMatch[1]) {
      let vpaName = vpaMatch[1].trim().toUpperCase();
      merchant = /^\d+$/.test(vpaName) ? 'VPA Transfer' : vpaName;
    } else {
      // Added ; and : to stop characters so it doesn't grab the UPI ID
      const fromRegex = /(?:from|by|via)\s+([A-Za-z\s&'\.]+?)(?=\s(?:on|ref|via|for|avbl|towards|upi|a\/c|account|using|from|by|balance|info|your|rrn)\b|[0-9]|\.\s*(?:RRN|Avl|Not)|;|:)/i;
      const fromMatch = cleanBody.match(fromRegex);
      if (fromMatch && fromMatch[1]) {
        merchant = fromMatch[1].trim().toUpperCase();
      }
    }
  } else {
    const vpaRegex = /(?:to|at|via)\s+([A-Za-z0-9\s&'-]+)@[a-z]+/i;
    const vpaMatch = cleanBody.match(vpaRegex);
    if (vpaMatch && vpaMatch[1]) {
      let vpaName = vpaMatch[1].trim().toUpperCase();
      merchant = /^\d+$/.test(vpaName) ? 'VPA Transfer' : vpaName;
    } else {
      // Added ; and : to stop characters so it doesn't grab the UPI ID
      const toRegex = /(?:to|at|via|towards)\s+([A-Za-z\s&'\.0-9]+?)(?=\s(?:on|ref|via|for|avbl|towards|upi|a\/c|account|using|from|by|balance|info|your|rrn|pause)\b|[0-9]|\.\s*(?:RRN|Avl|Not)|;|:)/i;
      const toMatch = cleanBody.match(toRegex);
      if (toMatch && toMatch[1]) {
        merchant = toMatch[1].trim().toUpperCase();
      }
    }
  }

  // Clean up trailing periods, semicolons, and common garbage words
  merchant = merchant.replace(/\b(ON|REF|AVBL|VIA|UPI|YBL|OKAXIS|OKHDFCBANK|VPA|A\/C|ACCT|ACCOUNT|BAL|RRN|WWW|COM|NOT YOU|SMS BLOCK|INFO|YOUR|NOTIF|TXN|TRF|TRANSFER)\b/g, '').trim();
  merchant = merchant.replace(/[;:\.]+$/, '').trim(); // Remove trailing semicolons, colons, periods

  // PSU Bank Special Handling (Canara, SBI, PNB often have specific strings)
  if (merchant.includes('VPA')) {
      const vpaMatch = cleanBody.match(/VPA\s+([A-Za-z0-9\s]+?)(?=\s|;|\.|$)/i);
      if (vpaMatch) merchant = vpaMatch[1].trim().toUpperCase();
  }

  // AMEX Special Handling
  if (upperBody.includes('AMEX') || upperBody.includes('AMERICAN EXPRESS')) {
      const amexMerchantMatch = cleanBody.match(/AT\s+([A-Za-z0-9\s&'-]+?)(?=\sON\s|\sAT\s|\sUSING\s|\sWITH\s|\.|$)/i);
      if (amexMerchantMatch) merchant = amexMerchantMatch[1].trim().toUpperCase();
      bank = 'AMEX';
  }

  if (merchant.length < 3) merchant = 'Unknown';

  // 6. Identify Bank
  if (upperBody.includes('HDFC')) bank = 'HDFC';
  else if (upperBody.includes('SBI')) bank = 'SBI';
  else if (upperBody.includes('ICICI')) bank = 'ICICI';
  else if (upperBody.includes('AXIS')) bank = 'AXIS';
  else if (upperBody.includes('KOTAK')) bank = 'KOTAK';
  else if (upperBody.includes('AMEX') || upperBody.includes('AMERICAN EXPRESS')) bank = 'AMEX';
  else if (upperBody.includes('INDIAN BANK')) bank = 'Indian Bank';
  else if (upperBody.includes('CANARA')) bank = 'Canara Bank';
  else if (upperBody.includes('PNB') || upperBody.includes('PUNJAB NATIONAL')) bank = 'PNB';
  else if (upperBody.includes('BOB') || upperBody.includes('BARODA')) bank = 'Bank of Baroda';
  else if (upperBody.includes('UNION BANK')) bank = 'Union Bank';

  const date = new Date(smsDate);
  return { amount, date, bank, raw: smsBody, type, merchant };
}