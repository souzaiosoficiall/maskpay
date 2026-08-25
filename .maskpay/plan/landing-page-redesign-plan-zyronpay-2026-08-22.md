# Landing Page Redesign Plan - ZyronPay

Redesign the landing page to align with the visual style of [MedusaPay](https://medusapay.com.br/), focusing on a clean, modern, and high-conversion layout while maintaining the ZyronPay orange branding.

## User Review Required

> [!IMPORTANT]
> The current primary color is a vibrant orange. MedusaPay uses a dark/minimalist aesthetic with primary call-to-actions. We will adapt this style using ZyronPay's orange.

## Proposed Changes

### Visual & Layout (Inspired by MedusaPay)
- **Hero Section**:
    - Large, bold typography.
    - Glassmorphism effects on UI elements.
    - Minimalist navigation with high-contrast CTAs.
- **Color Palette**:
    - Maintain `--primary` as vibrant orange.
    - Use more sophisticated dark/light contrasts (deep grays and crisp whites).
- **Components**:
    - Use rounded corners and subtle shadows.
    - Add a "Trusted by" section with gray-scaled logos.
    - Implement a " Bento Grid" style for features.
    - Add a sleek "How it works" step-by-step section.

### Structural Updates (`src/routes/index.tsx`)
- Refactor the navigation to be more compact.
- Overhaul the Hero section with better spacing and typography.
- Create a new "Feature Grid" component.
- Add a "Testimonials/Social Proof" section.
- Modernize the footer.

## Technical Details
- Use Tailwind CSS v4 utility classes.
- Lucide React for modern, consistent iconography.
- Framer Motion (or simple CSS transitions) for entrance animations.
- Responsive design focus (Mobile-first).

## Alternatives Considered
- **Strict Clone**: Rejected to maintain ZyronPay's unique brand identity while adopting the *feel* of MedusaPay.
- **Light Theme Only**: MedusaPay uses a mix; we will ensure both light and dark modes look professional.
