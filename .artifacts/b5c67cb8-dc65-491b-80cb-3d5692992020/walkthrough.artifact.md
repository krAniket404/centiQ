# Walkthrough - Fixing Empty Side Space

I have reduced the excessive empty space on the sides of the Budgets and Settings screens to ensure a consistent and wider layout across the app.

## Changes Made

### 1. Budgets Screen Optimization
- **[BudgetsScreen.tsx](file:///C:/Users/Sherly%20Sanjana.A/CentiQ/src/screens/BudgetsScreen.tsx):** Removed the screen-specific `paddingHorizontal: 16`. Since the app's root container already provides a standard 20px padding, this extra padding was causing the content to appear too narrow and disconnected from the Dashboard's alignment.

### 2. Settings Screen Alignment
- **[SettingsScreen.tsx](file:///C:/Users/Sherly%20Sanjana.A/CentiQ/src/screens/SettingsScreen.tsx):** Removed the `paddingHorizontal: 20` from the ScrollView's content container. This fix aligns the settings cards perfectly with the rest of the app's UI, utilizing more screen width for better legibility and a more "premium" feel.

## How to Verify
1. **Compare Tabs:** Toggle between the **Home** (Dashboard) tab and the **Budget** tab. You should notice that the cards now align exactly on the left and right edges.
2. **Settings Check:** Go to the **More** tab and verify that the prestige theme chips and security toggles are now wider and more visually appealing.
3. **Consistency:** Ensure no content is "clipping" against the edge (it shouldn't, as the 20px root padding is still active).
