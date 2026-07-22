import { parseBankSMS, ParsedTransaction } from './smsParser';
import { categorizeMerchant } from './categorizer';

export function backfillHistory(rawSmsList: any[]): ParsedTransaction[] {
  const parsedTxns = rawSmsList
    .map((sms: any) => parseBankSMS(sms.body, sms.date))
    .filter((txn: ParsedTransaction | null) => txn !== null) as ParsedTransaction[];

  // Enrich with categories
  parsedTxns.forEach(t => {
    t.category = categorizeMerchant(t.merchant);
  });

  return parsedTxns;
}