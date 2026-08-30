# Monthly Wrap Sharing Feature

This plan outlines the enhancements to the "Monthly Wrap" feature to enable users to share their financial journey across social platforms or with friends.

## User Review Required

> [!NOTE]
> The sharing will currently be text-based using the native `Share` API. This is the most compatible way to share across apps without requiring extra image-processing libraries.

## Proposed Changes

### [UI Components]

#### [MODIFY] [MonthlyWrapModal.tsx](file:///C:/Users/Sherly%20Sanjana.A/CentiQ/src/components/MonthlyWrapModal.tsx)
- **Enhanced Final Slide:** Redesign the last slide to include a "Shareable Card" look with a summary of stats.
- **Improved Share Message:** Update the shared text to include:
    - Wellness Score
    - Financial Persona (Identity)
    - Total Spent (formatted)
    - Top Spending Category
- **Visual Polish:** Add a "Share" icon (using MaterialCommunityIcons) to the action button for better visibility.

### [Theme & Styling]

#### [MODIFY] [MonthlyWrapModal.tsx](file:///C:/Users/Sherly%20Sanjana.A/CentiQ/src/components/MonthlyWrapModal.tsx)
- Update styles for the share button and summary card for better contrast and aesthetics.

## Verification Plan

### Manual Verification
1. Open the Monthly Wrap feature.
2. Progress through all slides.
3. On the final slide, verify the new summary details.
4. Click the "Share" button and ensure the native share sheet opens with the correct, detailed text.
