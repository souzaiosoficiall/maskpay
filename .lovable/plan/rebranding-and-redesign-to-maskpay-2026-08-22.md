# Rebranding and Redesign to MaskPay

Rebrand the platform from UnioPay to **MaskPay** with a black and gray theme, inspired by the minimalist and professional aesthetic of `zorinpay.com`.

## Design Changes
- **Color Palette**:
  - Primary: Silver/Gray (`oklch(0.85 0 0)`).
  - Background: "Combined" black (`oklch(0.12 0 0)`), providing a softer, more professional dark mode.
  - Borders: Subtle gray (`oklch(1 0 0 / 10%)`).
- **Typography**: Clean, bold sans-serif (Plus Jakarta Sans).
- **Iconography**: Replace Unio logos with a placeholder for MaskPay (using Lucide `Shield` or `Ghost` for a "Mask" feel, or text-based logo).

## Implementation Steps

### 1. Style Overhaul
- Update `src/styles.css` with the new color tokens.
- Adjust global border radius to match the more professional look of ZorinPay.

### 2. Branding Update
- Replace all "UnioPay" / "Unio" mentions with "MaskPay".
- Update the floating logo asset imports.

### 3. Landing Page (src/routes/index.tsx)
- **Header**: Clean, fixed navbar with MaskPay branding and minimalist navigation (Blog, Taxas).
- **Hero**: Reconstruct based on ZorinPay. Big bold headline, clean subtext, and high-impact CTA.
- **Visuals**: Use a clean dashboard preview or a 3D silver/gray element instead of the green coins.
- **Sections**: Add a "Features" grid and a "Trust" section with a minimalist aesthetic.

### 4. Auth Page (src/routes/auth.tsx)
- Update branding and colors to match the new MaskPay identity.
- Ensure the multi-step flow remains but with the new color scheme.

### 5. Dashboard (src/components/DashboardLayout.tsx)
- Update sidebar and topbar branding.
- Apply the new gray/black color scheme to the dashboard UI.
