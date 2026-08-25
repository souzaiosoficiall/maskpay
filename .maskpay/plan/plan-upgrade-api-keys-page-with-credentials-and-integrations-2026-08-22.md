# Plan - Upgrade API Keys Page with Credentials and Integrations

Update the API section to include Client ID and Secret ID management, including a generation flow and integrations for Utmfy and Google Analytics.

## User Review Required

> [!IMPORTANT]
> - The generation of Client ID and Secret ID will be a UI-only simulation for now.

## Proposed Changes

### API Keys Page
- **File:** `src/routes/_authenticated.api-keys.tsx`
- **Updates:**
    - Replace the existing key list with a "Credenciais da API" section.
    - Add fields for **Client ID** and **Secret ID** (initially empty or masked).
    - Add a "Gerar Credenciais" button to populate these IDs.
    - Implement a "Gerenciar Integrações" section below the credentials.
    - Add cards for **Utmfy** and **Google Analytics** with toggle switches or "Conectar" buttons.

### Styling
- Maintain the current dark, high-contrast black and white theme.
- Use large fonts and icons consistent with the recent dashboard updates.

## Technical Details

- Use `useState` to manage the generated IDs and integration statuses.
- Use `lucide-react` icons (e.g., `ShieldCheck`, `BarChart3`, `ExternalLink`) for the integrations.
- Ensure the layout is responsive and follows the `DashboardLayout` container constraints.
