/**
 * Encapsulated client for EvoPay API calls.
 * Runs strictly on the server-side to protect credentials.
 * Base URL: https://api.evopay.cash/v1
 * Auth: Authorization: Bearer <token>
 * @see https://docs.partners.evopay.cash/pt/guide/authentication
 */

interface ProviderRequestOptions {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
}

export async function callEvoPay(endpoint: string, options: ProviderRequestOptions = {}) {
  const token = process.env['EVOPAY_API_TOKEN'];

  if (!token) {
    console.error("[Audit] EVOPAY_API_TOKEN is NOT configured in the environment.");
    throw new Error("Configuração de pagamento ausente (Token não encontrado).");
  }

  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `https://api.evopay.cash/v1${path}`;
  const method = options.method || 'GET';

  console.log(`[Audit] Calling ${method} ${url}`, {
    bodyKeys: options.body ? Object.keys(options.body) : [],
  });

  const startTime = Date.now();

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token.trim()}`,
      },
    };

    if (options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);

    const duration = Date.now() - startTime;
    const bodyText = await response.text();
    let data: any = null;

    try {
      data = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      console.warn("[Audit] Failed to parse response body as JSON:", bodyText?.slice?.(0, 500));
    }

    if (!response.ok) {
      const detail =
        data?.message ||
        data?.error ||
        data?.detail ||
        data?.errors ||
        bodyText?.slice?.(0, 300) ||
        response.statusText;

      console.error(`[Audit] API Error Details:`, {
        endpoint: url,
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
        responseBody: data || bodyText?.slice?.(0, 500),
        clientReference: options.body?.clientReference,
      });

      if (response.status === 401) {
        throw new Error("Token da adquirente inválido ou não autorizado.");
      }
      if (response.status === 403) {
        throw new Error("Token da adquirente sem permissão necessária (DEPOSIT/WITHDRAW).");
      }
      if (response.status === 400 || response.status === 422) {
        throw new Error(
          `Dados inválidos enviados para a adquirente: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`
        );
      }
      if (response.status === 429) {
        throw new Error("Muitas requisições para a adquirente. Tente novamente em instantes.");
      }

      throw new Error(
        typeof detail === 'string' ? detail : "Erro na comunicação com a adquirente."
      );
    }

    console.log(`[Audit] Success ${url} (${duration}ms)`, {
      id: data?.id,
      keys: data && typeof data === 'object' ? Object.keys(data) : [],
    });
    return data;
  } catch (error: any) {
    if (error?.message && String(error.message).toLowerCase().includes('fetch')) {
      console.error("[Audit] Network Error:", error);
      throw new Error("Falha na rede ao conectar com a adquirente.");
    }
    throw error;
  }
}
