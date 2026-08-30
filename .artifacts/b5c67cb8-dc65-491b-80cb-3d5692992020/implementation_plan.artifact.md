# Implementation Plan - Fixing SMS Parsing for Specific ICICI Formats

The user reported two SMS formats from ICICI Bank that are not being parsed correctly. Analysis shows that the issues are related to transaction type detection (conflicting "debited" and "credited" keywords) and missing merchant extraction patterns for specific ICICI structures.

## User Review Required

> [!IMPORTANT]
> The fix involves changing the priority of transaction type detection and adding new regex patterns. This might affect how other mixed-keyword messages are parsed, but it is necessary for accuracy with modern banking formats.

## Proposed Changes

### SMS Parser Logic
#### [MODIFY] [smsParser.ts](file:///C:/Users/Sherly%20Sanjana.A/CentiQ/src/lib/smsParser.ts)
- **Prioritize Debit Detection:** Swap the order of checking `debitKeywords` and `creditKeywords`. This ensures that if a message says "debited for ...; merchant credited", it is correctly identified as a `debit` transaction.
- **Add ICICI Merchant Pattern (Debit):** Add a specific check for the pattern `; (.*?) CREDITED` when the transaction is a debit and the standard keywords (to, at, etc.) are missing.
- **Support Numbers in Credit Merchant Names:** Update `fromRegex` to include `0-9` in the allowed characters for merchant names, matching the `toRegex`.
- **Handle "Credited With" Format:** Ensure the parser correctly handles the "Acct ... is credited with Rs ..." format which is common in ICICI credit messages.

## Verification Plan

### Automated Tests
- I will mentally verify the regex changes against the provided examples:
  - **Debit Example:** "ICICI Bank Acct XX382 debited for Rs 499.00 on 27-Aug-26; SWIGGY INSTAMAR credited..."
    - Expected Result: Type: `debit`, Amount: `499.00`, Merchant: `SWIGGY INSTAMAR`, Bank: `ICICI`.
  - **Credit Example:** "Dear Customer, Acct XX382 is credited with Rs 242.61 on 25-Aug-26 from Rampalli Divya..."
    - Expected Result: Type: `credit`, Amount: `242.61`, Merchant: `RAMPALLI DIVYA`, Bank: `ICICI`.

### Manual Verification
- Since I cannot run the app with live SMS, I rely on the regex verification.
- The user can verify by checking if these transactions now appear in the "Spend" tab.
