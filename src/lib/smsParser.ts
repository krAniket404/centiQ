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
  let bank = 'Unknown Bank';
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

  // 2. Determine Transaction Type
  // DEBIT PRIORITY: If a message contains both, it's usually a "debited for... merchant credited" format.
  const debitKeywords = ['DEBITED', 'SPENT', 'PAID', 'PURCHASE', 'WITHDRAWN', 'SENT', 'DEDUCTED', 'DR.', 'DR '];
  const creditKeywords = ['CREDITED', 'RECEIVED', 'REFUND', 'ADDED', 'DEPOSITED', 'REVERSAL', 'CR.', 'CR '];

  if (debitKeywords.some(kw => upperBody.includes(kw))) {
    type = 'debit';
  } else if (creditKeywords.some(kw => upperBody.includes(kw))) {
    type = 'credit';
  } else {
    return null;
  }

  // 3. PRE-CLEAN: Remove the "Balance" part of the SMS so we don't accidentally grab the balance amount!
  const cleanBody = smsBody.split(/Avl Bal|Bal INR|Avl bal|Balance INR|Bal Rs|Account Balance/i)[0];

  // 4. Extract Amount
  const amountRegex = /(?:Rs\.?|INR|₹|credited with Rs|DR\.?|CR\.?|AMT)\s?([\d,]+\.?\d*)/i;
  const match = cleanBody.match(amountRegex);
  if (match && match[1]) {
    amount = parseFloat(match[1].replace(/,/g, ''));
    if (amount <= 0) return null;
  } else {
    return null;
  }

  // 5. Extract Merchant / Person Name
  if (type === 'credit') {
    const fromRegex = /(?:from|by|via|received from)\s+([A-Za-z0-9\s&'\.]+?)(?=\s(?:on|ref|via|for|avbl|towards|upi|a\/c|account|using|from|by|balance|info|your|rrn)\b|[0-9]|\.\s*(?:RRN|Avl|Not)|;|:|$)/i;
    const fromMatch = cleanBody.match(fromRegex);
    if (fromMatch && fromMatch[1]) {
      merchant = fromMatch[1].trim().toUpperCase();
    }
  } else {
    const vpaRegex = /(?:to|at|via)\s+([A-Za-z0-9\s&'-]+)@[a-z]+/i;
    const vpaMatch = cleanBody.match(vpaRegex);
    if (vpaMatch && vpaMatch[1]) {
      let vpaName = vpaMatch[1].trim().toUpperCase();
      merchant = /^\d+$/.test(vpaName) ? 'VPA Transfer' : vpaName;
    } else {
      const toRegex = /(?:to|at|via|towards)\s+([A-Za-z\s&'\.0-9]+?)(?=\s(?:on|ref|via|for|avbl|towards|upi|a\/c|account|using|from|by|balance|info|your|rrn|pause)\b|[0-9]|\.\s*(?:RRN|Avl|Not)|;|:|$)/i;
      const toMatch = cleanBody.match(toRegex);
      if (toMatch && toMatch[1]) {
        merchant = toMatch[1].trim().toUpperCase();
      }

      // ICICI Special: "...debited...; MERCHANT credited"
      if (!merchant || merchant === 'Unknown' || merchant.length < 2) {
        const iciciDebitMatch = cleanBody.match(/;\s+([A-Za-z\s&']+?)\s+CREDITED/i);
        if (iciciDebitMatch) merchant = iciciDebitMatch[1].trim().toUpperCase();
      }
    }
  }

  // Clean up trailing periods, semicolons, and common garbage words
  merchant = merchant.replace(/\b(ON|REF|AVBL|VIA|UPI|YBL|OKAXIS|OKHDFCBANK|VPA|A\/C|ACCT|ACCOUNT|BAL|RRN|WWW|COM|NOT YOU|SMS BLOCK|INFO|YOUR|NOTIF|TXN|TRF|TRANSFER)\b/g, '').trim();
  merchant = merchant.replace(/[;:\.]+$/, '').trim();

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
  const bankPatterns = [
    { name: 'HDFC', pattern: /HDFC/i },
    { name: 'SBI', pattern: /SBI/i },
    { name: 'ICICI', pattern: /ICICI/i },
    { name: 'AXIS', pattern: /AXIS/i },
    { name: 'KOTAK', pattern: /KOTAK/i },
    { name: 'AMEX', pattern: /AMEX|AMERICAN EXPRESS/i },
    { name: 'PNB', pattern: /PNB|PUNJAB NATIONAL/i },
    { name: 'BOB', pattern: /BOB|BARODA/i },
    { name: 'Canara Bank', pattern: /CANARA/i },
    { name: 'Indian Bank', pattern: /INDIAN BANK/i },
    { name: 'Union Bank', pattern: /UNION BANK/i },
    { name: 'Yes Bank', pattern: /YES BANK/i },
    { name: 'IndusInd', pattern: /INDUSIND/i },
    { name: 'IDFC', pattern: /IDFC/i },
    { name: 'Standard Chartered', pattern: /SCB|STANDARD CHARTERED/i }
  ];

  for (const { name, pattern } of bankPatterns) {
    if (pattern.test(upperBody)) {
      bank = name;
      break;
    }
  }

  const date = new Date(smsDate);
  return { amount, date, bank, raw: smsBody, type, merchant };
}
