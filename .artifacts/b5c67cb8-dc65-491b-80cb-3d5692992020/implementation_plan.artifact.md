# Implementation Plan - Reducing Empty Side Space in Budgets and Settings

The user reported excessive empty space on the sides of the Budgets and Settings screens. This is likely because these screens have their own horizontal padding which adds to the root container's padding in `App.tsx`.

## Proposed Changes

### Screens
#### [MODIFY] [BudgetsScreen.tsx](file:///C:/Users/Sherly%20Sanjana.A/CentiQ/src/screens/BudgetsScreen.tsx)
- Remove `paddingHorizontal: 16` from the `ScrollView`'s `contentContainerStyle`. This will leave only the 20px padding from the root container in `App.tsx`, matching the rest of the app's layout.

#### [MODIFY] [SettingsScreen.tsx](file:///C:/Users/Sherly%20Sanjana.A/CentiQ/src/screens/SettingsScreen.tsx)
- Remove `paddingHorizontal: 20` from the `ScrollView`'s `contentContainerStyle`. This will leave only the 20px padding from the root container in `App.tsx`.

## Verification Plan

### Manual Verification
1.  **Budgets Screen:** Open the "Budget" tab and verify that the cards are wider and align with the Dashboard's layout.
2.  **Settings Screen:** Open the "More" tab and verify that the settings cards are wider and align with the rest of the app.
3.  **Consistency Check:** Ensure all screens (Home, Spend, Budget, Coach, More) have a consistent side margin.
