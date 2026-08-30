import { parseBankSMS } from '../../src/lib/smsParser';

const testCases = [
  {
    name: "ICICI Debit (User Case 1)",
    body: "ICICI Bank Acct XX382 debited for Rs 551.00 on 30-Aug-26; Blinkit credited. UPI:617454720686. Call 18002662 for dispute. SMS BLOCK 382 to 9215676766.",
    expectedType: "debit",
    expectedMerchant: "BLINKIT"
  },
  {
    name: "ICICI Debit (User Case 2)",
    body: "ICICI Bank Acct XX382 debited for Rs 164.00 on 30-Aug-26; SWIGGY INSTAMAR credited. UPI:898658059504. Call 18002662 for dispute. SMS BLOCK 382 to 9215676766.",
    expectedType: "debit",
    expectedMerchant: "SWIGGY INSTAMAR"
  },
  {
    name: "SBI Debit",
    body: "Your A/c XXXXX1234 is debited by Rs. 500.00 on 30-Aug-26 towards UPI Ref 617454720686. Not you? Call...",
    expectedType: "debit",
    expectedMerchant: "UPI REF" // This might need refinement if we want the actual merchant, but "UPI REF" is a common fallback
  },
  {
    name: "HDFC Credit",
    body: "HDFC Bank: Rs 1000.00 credited to A/c XX1234 on 30-Aug-26 by NEFT from ZOMATO. Avbl Bal: INR 5000.00",
    expectedType: "credit",
    expectedMerchant: "ZOMATO"
  },
  {
    name: "Generic Transfer",
    body: "Transferred Rs 200 to AMIT via GPay. Ref: 123456789.",
    expectedType: "debit",
    expectedMerchant: "AMIT"
  }
];

console.log("--- SMS Parser Verification ---");
testCases.forEach(tc => {
  const result = parseBankSMS(tc.body, Date.now());
  console.log(`\nTest: ${tc.name}`);
  if (result) {
    console.log(`  Type: ${result.type} (Expected: ${tc.expectedType})`);
    console.log(`  Amount: ${result.amount}`);
    console.log(`  Merchant: ${result.merchant} (Expected: ${tc.expectedMerchant})`);
    console.log(`  Bank: ${result.bank}`);

    const typeMatch = result.type === tc.expectedType;
    const merchantMatch = result.merchant.includes(tc.expectedMerchant) || tc.expectedMerchant.includes(result.merchant);

    if (typeMatch && merchantMatch) {
      console.log("  Result: PASS ✅");
    } else {
      console.log("  Result: FAIL ❌");
    }
  } else {
    console.log("  Result: FAIL (No result) ❌");
  }
});
