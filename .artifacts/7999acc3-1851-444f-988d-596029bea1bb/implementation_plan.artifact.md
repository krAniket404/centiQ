# Behavioral Tracking & Subscription Intelligence Enhancements

This plan aims to refine the discipline tracking, enhance subscription leak detection to a "dedicated app" level, and improve transaction presentation.

## User Review Required

> [!IMPORTANT]
> - **Streak Reset:** All existing discipline streaks will be reset because we are switching to a "start from activation date" model.
> - **Category Merger:** "Food Delivery" and "Fast Food" are being combined into a single "Food & Dining" category for more focused tracking.
> - **Subscription Intelligence:** The app will now look for billing cycles (e.g., exactly 30 days apart) to distinguish between recurring bills and random repetitive spending.

## Proposed Changes

### [Behavioral Intelligence]

#### [MODIFY] [behavioralEngine.ts](file:///C:/Users/Sherly%20Sanjana.A/CentiQ/src/lib/behavioralEngine.ts)
- Enhance `detectSubscriptionLeaks`:
    - Add cycle detection (detects 30-day or 365-day billing patterns).
    - Add amount consistency checking (exact match detection).
    - Differentiate between "Confirmed Subscriptions" (Cycle + Keyword match) and "Repetitive Payments" (Frequent hits).
- Update `RecurringCharge` interface to include `nextBillingDate` and `confidence`.

### [Core App Logic]

#### [MODIFY] [App.tsx](file:///C:/Users/Sherly%20Sanjana.A/CentiQ/App.tsx)
- **Streak Logic:**
    - Change `activeStreaks` state to store a mapping of `streakId -> activationTimestamp`.
    - Update `streakData` calculation to stop looking back once the `checkDate` is earlier than the activation date.
- **Category Merging:**
    - Combine `food_delivery` and `fast_food` into `food_and_dining`.
    - Update the merchant keyword list to include both delivery services (Swiggy, Zomato) and fast-food chains (KFC, McDonald's).
- **Naming Convention:**
    - Update `monthlyWrapData` and UI components to use the refined merchant names from the parser.

### [Data Parsing]

#### [MODIFY] [smsParser.ts](file:///C:/Users/Sherly%20Sanjana.A/CentiQ/src/lib/smsParser.ts)
- **Merchant Cleaning:**
    - Remove more UPI-specific prefix/suffixes (e.g., `UPI-`, `-UPI`, `*`).
    - Implement **Title Case** formatting (e.g., `SWIGGY INSTAMART` -> `Swiggy Instamart`) for a cleaner look.
- **Improved Extraction:** Refine regex to better handle mixed-case merchants found in notifications.

### [UI & Settings]

#### [MODIFY] [SettingsScreen.tsx](file:///C:/Users/Sherly%20Sanjana.A/CentiQ/src/screens/SettingsScreen.tsx)
- Update the feature list to reflect the merged "Food & Dining" category.

## Verification Plan

### Automated Tests
- Create a scratch test `test_subscription_intelligence.ts`:
    - Simulate a merchant with transactions exactly 30 days apart.
    - Simulate a merchant with varying dates but consistent amounts.
    - Verify cycle detection accuracy.
- Create a scratch test `test_naming_convention.ts`:
    - Verify Title Case conversion.
    - Verify removal of artifacts like `UPI-`.

### Manual Verification
- Activate a new streak and verify it starts at `0 days` (even if you had no bad transactions yesterday).
- Check the "Subscription Audit" card to see billing cycle info.
- Verify that "Swiggy" and "KFC" both trigger the same "Food & Dining" streak.
