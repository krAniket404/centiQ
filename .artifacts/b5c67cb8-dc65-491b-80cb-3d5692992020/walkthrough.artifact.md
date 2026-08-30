# Walkthrough - Fixing SMS Parsing for ICICI Bank

I have updated the SMS parsing logic to support specific transaction formats from ICICI Bank that were previously ignored or misidentified.

## Changes Made

### 1. Transaction Type Priority
- **[smsParser.ts](file:///C:/Users/Sherly%20Sanjana.A/CentiQ/src/lib/smsParser.ts):** Changed the priority of transaction type detection. The parser now checks for `debitKeywords` before `creditKeywords`.
- **Why:** This correctly handles ICICI messages like "...debited for Rs 499... SWIGGY credited", which were previously incorrectly identified as credits due to the second keyword.

### 2. Improved Merchant Extraction
- **ICICI Specific Pattern:** Added a new regex pattern `; (.*?) CREDITED` for debit transactions. This specifically targets the merchant name in ICICI's mixed-keyword debit messages.
- **Numbers in Sender Names:** Updated the `fromRegex` (for credits) to allow digits. This ensures names like "Rampalli Divya" or merchants with numbers are correctly captured.
- **"Credited With" Support:** Enhanced the amount extraction regex to explicitly support the "is credited with Rs" format used by ICICI.

## Results
- **Debit Format Fixed:** "ICICI Bank Acct XX382 debited for Rs 499.00 on 27-Aug-26; SWIGGY INSTAMAR credited..." is now correctly parsed as a **₹499.00 Debit** to **SWIGGY INSTAMAR**.
- **Credit Format Fixed:** "Dear Customer, Acct XX382 is credited with Rs 242.61 on 25-Aug-26 from Rampalli Divya..." is now correctly parsed as a **₹242.61 Credit** from **RAMPALLI DIVYA**.

## How to Verify
1. Open the app and go to the **Spend** (Transactions) tab.
2. If you have these specific ICICI messages in your SMS inbox, they should now appear in the list with the correct amount, type, and merchant name.
