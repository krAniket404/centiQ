# Fix Budget Setting & Privacy Lock Features

This plan addresses issues with budget management and the biometric privacy lock, ensuring a smoother user experience and reliable security.

## User Review Required

> [!IMPORTANT]
> **Privacy Lock Change:** I will fix the crash/failure in the Biometric Prompt by removing the conflicting "Cancel" button when system credentials (PIN/Pattern) are enabled. This will allow users to use their phone's existing password if biometrics aren't available.
>
> **Budget Interaction:** Tapping a category will now clearly distinguish between viewing transactions (tap name/icon) and editing the budget (tap the amount).

## Proposed Changes

### [UI Components]

#### [MODIFY] [BudgetsScreen.tsx](file:///C:/Users/Sherly%20Sanjana.A/CentiQ/src/screens/BudgetsScreen.tsx)
- **Resolve Interaction Conflict:** Move the "View Transactions" trigger away from the budget input field.
- **Input Improvements:** Use `number-pad` for better numeric entry and add a focus state to the input wrapper.
- **Persistence:** Ensure budgets are saved correctly to local storage with a debounce to prevent lag.

### [Native Android]

#### [MODIFY] [SmsModule.kt](file:///C:/Users/Sherly%20Sanjana.A/CentiQ/android/app/src/main/java/com/centiq/SmsModule.kt)
- **Fix BiometricPrompt Crash:** Remove `setNegativeButtonText` when `DEVICE_CREDENTIAL` is included in allowed authenticators, as per Android API requirements.
- **Improved Error Handling:** Pass specific error codes back to React Native to differentiate between "Cancelled", "Not Enrolled", and "Hardware Unavailable".

### [Core Logic]

#### [MODIFY] [App.tsx](file:///C:/Users/Sherly%20Sanjana.A/CentiQ/App.tsx)
- **Robust Lock Handling:**
    - Don't immediately lock the app if biometric setup fails during the initial toggle.
    - Provide a "Retry" button on the lock screen.
    - Handle the "Not Enrolled" case by alerting the user to set up a device lock first.

## Verification Plan

### Manual Verification
1. **Budget Test:** Go to Budgets, tap the amount, change it, and verify it saves. Tap the category name and verify transactions show.
2. **Security Test (Enrolled):** Enable Privacy Lock, minimize app, reopen, and verify the biometric prompt appears with a "Use PIN/Password" option.
3. **Security Test (Not Enrolled):** Try to enable Privacy Lock on a device with no security and verify the app provides a helpful message instead of just locking.
