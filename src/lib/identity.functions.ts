import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const validateCPFAction = createServerFn({ method: "POST" })
  .validator((data: unknown) => 
    z.object({
      document: z.string().min(14, { message: "CPF INVÁLIDO" }),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { validateCPF, consultCPFExternal } = await import("./identity.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cleanCpf = data.document.replace(/\D/g, '');

    // 1. Validação Matemática
    if (!validateCPF(cleanCpf)) {
      throw new Error("CPF informado é matematicamente inválido.");
    }

    // 2. Verificar duplicidade no banco
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('document', cleanCpf)
      .maybeSingle();

    if (existing) {
      throw new Error("Este CPF já está cadastrado em outra conta.");
    }

    // 3. Consulta Externa (opcional baseada em Secrets)
    const apiKey = process.env['CPF_VALIDATION_API_KEY'];
    const endpoint = process.env['CPF_VALIDATION_ENDPOINT'];

    if (apiKey && endpoint) {
      const result = await consultCPFExternal(cleanCpf, apiKey, endpoint);
      return { 
        valid: true, 
        name: result.name,
        source: 'external'
      };
    }

    return { 
      valid: true, 
      name: null,
      source: 'mathematical'
    };
  });
