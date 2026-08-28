# Implementation Plan - CentiQ Dashboard & Persistence Enhancements

This plan addresses five items: fixing discipline streaks, adding 24-hour vault reminders, implementing dashboard customization (pin/unpin), adding a monthly spend tracker, and ensuring notifications open the app.

## User Review Required

> [!IMPORTANT]
> **24-Hour Reminders:** Reminders will trigger every 6 hours from the time a purchase is "locked". This requires a persistent background alarm.
> **Dashboard State:** Dashboard customization will be saved locally. If you clear app data, the layout will reset to default (all pinned).

## Proposed Changes

### Android Native Layer

#### [MODIFY] [SmsReceiver.kt](file:///C:/Users/Sherly Sanjana.A/CentiQ/android/app/src/main/java/com/centiq/SmsReceiver.kt)
- Add a `contentIntent` to the notification builder so tapping the notification body opens the app.

#### [MODIFY] [QNotificationListener.kt](file:///C:/Users/Sherly Sanjana.A/CentiQ/android/app/src/main/java/com/centiq/QNotificationListener.kt)
- Add a `contentIntent` to the behavioral notification builder.

#### [MODIFY] [SmsModule.kt](file:///C:/Users/Sherly Sanjana.A/CentiQ/android/app/src/main/java/com/centiq/SmsModule.kt)
- Add `scheduleRepeatingNotification(id: String, intervalHours: Double, title: String, message: String)` to handle the 6-hour vault reminders.
- Add `cancelNotification(id: String)` to stop reminders when a purchase is resolved.

---

### Shared Logic Layer (TypeScript)

#### [MODIFY] [App.tsx](file:///C:/Users/Sherly Sanjana.A/CentiQ/App.tsx)
- **Fix Streaks:**
    - Update `streakData` to start checking from *today* instead of yesterday.
    - Improve date comparison logic to avoid timezone-related misses.
    - Add safety checks for `activeStreaks`.
- **Monthly Spend:**
    - Add `monthlySpendTotal` useMemo to calculate the sum of all debits in the current calendar month.
- **Dashboard Pinning:**
    - Add `pinnedFeatures` state (array of strings).
    - Add toggle functions to pin/unpin specific cards.
    - Save/Load this state from `SmsModule` storage.
- **Vault Logic:**
    - When `addPendingPurchase` is called, trigger the native `scheduleRepeatingNotification` for 6-hour checks.
    - When `resolvePurchase` is called, trigger `cancelNotification`.

---

### UI Layer

#### [MODIFY] [App.tsx](file:///C:/Users/Sherly Sanjana.A/CentiQ/App.tsx) (Styles & Component)
- Add a "Monthly Spend" indicator in the dashboard header.
- Add a small "Unpin" (close icon) to each major card on the dashboard.
- Add an "Edit Dashboard" section in Settings to re-pin hidden features.
- Update each card to conditionally render based on the `pinnedFeatures` list.

## Verification Plan

### Automated Tests
- N/A for UI/Native logic mostly, but I will verify `streakData` logic with edge-case date strings.

### Manual Verification
- **Streak Fix:** Add a transaction for "2 AM today" and verify the `late_night` streak resets to 0.
- **Monthly Spend:** Verify the total matches the sum of transactions shown in the "Spend" tab for this month.
- **Pin/Unpin:** Unpin the "Heatmap" and verify it disappears. Re-pin it from Settings and verify it returns.
- **Reminders:** Verify that `SmsModule` successfully calls the alarm manager (via logs).
- **Notification Click:** Click a transaction notification and verify the app comes to the foreground.
