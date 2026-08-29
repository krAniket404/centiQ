# Implementation Plan - Intelligence & Multi-Account Support

This update focuses on predictive financial intelligence, automated vault suggestions, and broader bank support (HDFC, ICICI, Amex).

## User Review Required

> [!IMPORTANT]
> **Predictive AI:** The accuracy of the "Budget Breach Date" depends on having at least 7 days of data for the current month. If data is insufficient, we will show "Calculating...".

> [!TIP]
> **Vault Sweep:** This is a manual-trigger automation. Q will suggest it when you are under budget at the end of the month, but you must confirm the "Sweep" to move funds to your Icelandic Trip vault.

## Proposed Changes

### 1. Multi-Account SMS Parsing
- **[MODIFY] [smsParser.ts](file:///C:/Users/Sherly Sanjana.A/CentiQ/src/lib/smsParser.ts):**
    - Add specific parsing patterns for **Amex** (American Express).
    - Refine HDFC and ICICI patterns to handle more variations (Credit Card vs UPI).
    - Support "Available Credit Limit" exclusion for Amex/HDFC.

### 2. Predictive Budget AI
- **[MODIFY] [App.tsx](file:///C:/Users/Sherly Sanjana.A/CentiQ/App.tsx) / [behavioralEngine.ts](file:///C:/Users/Sherly Sanjana.A/CentiQ/src/lib/behavioralEngine.ts):**
    - Implement `calculateBurnRate()`: Analyzes daily spending velocity for each category.
    - Implement `predictBreachDate()`: Extrapolates velocity to find the date when `Spent > Budget`.
- **[MODIFY] [BudgetsScreen.tsx](file:///C:/Users/Sherly Sanjana.A/CentiQ/src/screens/BudgetsScreen.tsx):**
    - Add a "Predicted Breach" indicator on each category card.
    - Example: "⚠️ Predicted to breach on Sept 24".

### 3. Vault Automation (Budget Sweep)
- **[MODIFY] [App.tsx](file:///C:/Users/Sherly Sanjana.A/CentiQ/App.tsx):**
    - Logic to detect "Budget Surplus" (Difference between Total Budget and Total Spent).
    - If today is within the last 5 days of the month and `Remaining > ₹1000`, show a "Sweep Suggestion" in the AI Coach feed.
- **[MODIFY] [AICoachScreen.tsx](file:///C:/Users/Sherly Sanjana.A/CentiQ/src/screens/AICoachScreen.tsx):**
    - Proactive prompt: "You have ₹4,200 left in your budget! Want to sweep this into your 'Iceland Trip' vault? ❄️"

### 4. UI Legibility Fix
- **[MODIFY] [App.tsx](file:///C:/Users/Sherly Sanjana.A/CentiQ/App.tsx) / [TransactionsScreen.tsx](file:///C:/Users/Sherly Sanjana.A/CentiQ/src/screens/TransactionsScreen.tsx):**
    - Replace all instances of `color: '#001018'` or `color: '#000'` inside colored buttons/chips with dynamic theme text colors or high-contrast shades.
    - Fix the "Black on Black" visibility issue mentioned (likely in the active category chips and primary buttons).

---

## Verification Plan

### Manual Verification
1.  **Amex Support:** Mock an Amex SMS and verify amount/merchant extraction.
2.  **Prediction:** Spend ₹3000 in 3 days on a ₹5000 budget. Verify the app predicts a breach in ~2 days.
3.  **Sweep:** Set total budget higher than spend. Verify the AI Coach suggests sweeping the surplus.
4.  **UI:** Check all buttons/chips to ensure text is white/legible on dark backgrounds.
