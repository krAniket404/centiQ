# CentiQ Dashboard & Persistence Tasks

- [x] **Android Native Layer**
    - [x] Update `SmsReceiver.kt` to ensure notifications open the app.
    - [x] Update `QNotificationListener.kt` to ensure notifications open the app.
    - [x] Add `scheduleRepeatingNotification` and `cancelNotification` to `SmsModule.kt`.
- [x] **Shared Logic Layer (TypeScript)**
    - [x] Fix `streakData` counting logic (start from today, better date matching).
    - [x] Implement `monthlySpendTotal` calculation.
    - [x] Add `pinnedFeatures` state management (load/save).
- [x] **App UI Layer**
    - [x] Add "Monthly Spend" display to Dashboard header.
    - [x] Implement "Unpin" UI (close icon) on dashboard cards.
    - [x] Implement "Edit Dashboard" UI in Settings.
    - [x] Integrate 6-hour Vault reminders in `addPendingPurchase` and `resolvePurchase`.
- [x] **Verification**
    - [x] Verify streak counts correctly reset/increment.
    - [x] Verify notifications open the app.
    - [x] Verify vault reminders are scheduled (logs).
