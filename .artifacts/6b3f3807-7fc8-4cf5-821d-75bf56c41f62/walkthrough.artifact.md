# Walkthrough - Prestige Update

I have transformed CentiQ into a world-class luxury finance application with the "Prestige" feature set.

## New Feature Highlights

### 1. Interactive Monthly Recap (Stories)
The "Monthly Wrap" has been completely reimagined into a full-screen, **Spotify Stories** format.
- **Dynamic Slides:** Auto-advancing slides covering your Wellness Score, Persona Evolution, Top Categories, and your "Biggest Victory" (or Impulse).
- **Smooth Navigation:** Tap the right side to advance or left to go back.
- **Progress Indicators:** Visual bars at the top show you where you are in your monthly journey.

### 2. Elite Security (Biometric Lock)
CentiQ now features a native **Biometric Privacy Lock** to protect your sensitive financial data.
- **Executive Security:** Toggle "Biometric Privacy Lock" in Settings to require Fingerprint or FaceID every time the app is opened.
- **Native Bridge:** Built using the Android `BiometricPrompt` API for maximum reliability and speed.

### 3. Smart Luxury Themes
Personalize your dashboard with four high-end **Prestige Themes**:
- **Azure Glass:** The classic refined blue.
- **Royal Emerald:** A deep green for disciplined savers.
- **Midnight Gold:** A prestigious gold for high-earners.
- **Amethyst:** A royal purple for the Balanced Spender.
*Switch themes instantly in the "More" tab.*

### 4. Intelligence & Multi-Account Support
- **Multi-Bank Parsing:** Added full support for **American Express (Amex)** SMS formats and improved extraction for HDFC and ICICI credit card alerts.
- **Predictive Budgeting:** The Budget tab now shows a **"⚠️ Predicted Breach"** date for each category if your current spending velocity suggests you'll run out of money before the month ends.
- **Vault Automation (The Sweep):** In the final days of the month, if you have a budget surplus, Q will suggest a **"Vault Sweep"** in your AI Feed. Tapping it will move those "lazy" funds into your highest-priority savings goal automatically.
- **Legibility Overhaul:** Eliminated all "black-on-black" text issues. All primary buttons and active chips now use high-contrast white text, ensuring visibility across all Prestige Themes.

## How to Verify

1.  **Test Prediction:** Set a tight budget for a category and log a few transactions. The **Budgets** tab will show your predicted breach date (e.g., "⚠️ BREACH 24 SEP").
2.  **Vault Sweep:** If it's near the end of the month and you have a surplus, look for the **"VAULT SWEEP"** card in the dashboard's AI Feed. Tap it to confirm the sweep into your trip vault.
3.  **UI Check:** Switch between themes in **Settings** and verify that all button text remains clearly legible (white) on the accent backgrounds.
4.  **Amex Parsing:** Mock an Amex SMS (e.g., "Spent ₹5000 at AMEX using card..."). Verify the bank is identified as 'AMEX' and the merchant is correctly captured.

> [!CAUTION]
> If you enable the **Biometric Lock**, ensure your device has a fingerprint or face registered, or you will need to use your device PIN to unlock the app.
