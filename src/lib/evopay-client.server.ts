/**
 * Encapsulated client for provider API calls.
 * Runs strictly on the server-side to protect credentials.
 */

interface ProviderRequestOptions {
  method?: 'GET' | 'POST';
  body?: any;
}

export async function callEvoPay(endpoint: string, options: ProviderRequestOptions = {}) {
  const token = process.env['EVOPAY_API_TOKEN'];
  
  if (!token) {
    console.error("[Audit] EVOPAY_API_TOKEN is NOT configured in the environment.");
    throw new Error("Configuração de pagamento ausente (Token não encontrado).");
  }

  const url = `https://api.evopay.cash/v1${endpoint}`;
  const method = options.method || 'GET';
  
  console.log(`[Audit] Calling ${method} ${url}`);
  
  const startTime = Date.now();
  
  try {
    const fetchOptions: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.trim()}`
      }
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
    } catch (e) {
      console.warn("[Audit] Failed to parse response body as JSON:", bodyText);
    }

    if (!response.ok) {
      console.error(`[Audit] API Error Details:`, {
        endpoint: url,
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
        responseBody: data || bodyText,
        clientReference: options.body?.clientReference || options.body?.external_id
      });

      // Specific error mapping based on HTTP Status
      if (response.status === 401) {
        throw new Error("Token da adquirente inválido ou não autorizado.");
      }
      if (response.status === 403) {
        throw new Error("Token da adquirente sem permissão necessária (DEPOSIT/CASH_OUT).");
      }
      if (response.status === 400 || response.status === 422) {
        throw new Error(`Dados inválidos enviados para a adquirente: ${data?.message || 'Verifique o formato do payload.'}`);
      }
      if (response.status === 429) {
        throw new Error("Muitas requisições para a adquirente. Tente novamente em instantes.");
      }
      
      throw new Error(data?.message || "Erro na comunicação com a adquirente.");
    }

    console.log(`[Audit] Success ${url} (${duration}ms)`);
    return data;
    
  } catch (error: any) {
    if (error.message.includes("fetch")) {
      console.error("[Audit] Network Error:", error);
      throw new Error("Falha na rede ao conectar com a adquirente.");
    }
    throw error;
  }
}
