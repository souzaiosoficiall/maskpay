# Re-design the error page

Improve the error page (`ErrorComponent` in `src/routes/__root.tsx`) to match the MaskPay aesthetic: dark theme, platform logo, and a Portuguese "Voltar ao menu inicial" button.

## Proposed Changes

### Root Layout
- **File:** `src/routes/__root.tsx`
- **Component:** `ErrorComponent`
- **Enhancements:**
    - Add MaskPay logo and name at the top.
    - Translate text to Portuguese.
    - Simplify navigation to a single "Voltar ao menu inicial" button.
    - Ensure styling matches the current dark theme (`bg-background`, `text-foreground`).

## Technical Details
- Use `logoAsset` from `@/assets/ICON_MASCARA_SEM_FUNDO.png.asset.json`.
- Replace "This page didn't load" with "Opa! Algo deu errado." or similar.
- Replace "Go home" with "Voltar ao menu inicial".
- Remove the "Try again" button as per the simplified requirement.
