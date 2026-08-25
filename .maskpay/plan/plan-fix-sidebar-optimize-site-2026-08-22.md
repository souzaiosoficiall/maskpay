# Plan: Fix Sidebar & Optimize Site

Fix the sidebar navigation issue in the deposit page and perform a general audit for bugs and performance optimizations.

## Proposed Changes

### 1. Fix Sidebar Navigation in Deposit Page
- **Problem**: The user reports that sidebar functions stop working when in the deposit tab.
- **Cause**: Likely an overlay, a layout mismatch, or a missing context/state in the `_authenticated.deposit.tsx` file compared to other routes.
- **Fix**: Verify the layout wrapper and ensure no full-screen overlays are blocking interaction.

### 2. General Bug Audit & Fixes
- **Dashboard Filters**: Ensure all filters (Today, Yesterday, etc.) update the charts and stats across all dashboard views.
- **Routes Audit**: Check `_authenticated.customers`, `rates`, `support`, and `settings` to ensure they aren't just empty placeholders.
- **Form Validations**: Verify input masking and validation for Pix keys and amounts.

### 3. Performance & Fluidity Optimizations
- **Animation Tweak**: Optimize `framer-motion` transitions to use `layout` props where beneficial to prevent layout shifts.
- **Dynamic Imports**: Consider lazy-loading heavy components if any are identified.
- **CSS Cleanup**: Ensure Tailwind v4 variables are used consistently to avoid redundant styles.
- **Memoization**: Add `useMemo` and `useCallback` in high-frequency update components (like the animated revenue chart).

## Technical Details
- Audit `src/components/DashboardLayout.tsx` for z-index or pointer-event issues.
- Update placeholder routes with realistic UI mockups.
- Refine `src/routes/index.tsx` animations for smoother scroll performance.
