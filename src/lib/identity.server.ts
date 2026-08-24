
export function validateCPF(cpf: string): boolean {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
  
  const cpfArr = cpf.split('').map(el => +el);
  const rest = (count: number) => (cpfArr.slice(0, count - 12).reduce((soma, el, index) => soma + el * (count - index), 0) * 10) % 11 % 10;
  
  return rest(10) === cpfArr[9] && rest(11) === cpfArr[10];
}

export async function consultCPFExternal(cpf: string, apiKey: string, endpoint: string): Promise<{ name: string | null; error?: string }> {
  try {
    const cleanCpf = cpf.replace(/\D/g, '');
    
    // Exemplo de integração genérica (ajustar conforme o provedor escolhido)
    // Muitos provedores usam GET com o CPF no path ou query params
    const response = await fetch(`${endpoint}?token=${apiKey}&cpf=${cleanCpf}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return { name: null, error: 'Falha na consulta externa' };
    }

    const data = await response.json();
    
    // Mapeamento comum de APIs de consulta de CPF (nome, situacao, etc)
    const name = data.nome || data.name || data.nome_completo || null;
    
    return { name };
  } catch (err) {
    console.error('[consultCPFExternal] Error:', err);
    return { name: null, error: 'Erro de conexão com o provedor de identidade' };
  }
}
