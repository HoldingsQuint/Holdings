// Chamadas à API do Asaas. A chave fica só nos segredos (ASAAS_API_KEY).
// ASAAS_API_URL: padrão produção (https://api.asaas.com/v3); sandbox: https://api-sandbox.asaas.com/v3
function base(): string {
  return (Deno.env.get("ASAAS_API_URL") ?? "https://api.asaas.com/v3").replace(/\/$/, "");
}

export async function asaas(caminho: string, init: RequestInit = {}): Promise<any> {
  const chave = Deno.env.get("ASAAS_API_KEY");
  if (!chave) throw new Error("ASAAS_API_KEY ausente");
  const r = await fetch(base() + caminho, {
    ...init,
    headers: { access_token: chave, "Content-Type": "application/json", "User-Agent": "holdings-quintiliano", ...(init.headers ?? {}) },
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`asaas ${caminho} ${r.status}: ${JSON.stringify(corpo.errors ?? corpo)}`);
  return corpo;
}

export async function buscarCliente(id: string): Promise<{ nome?: string; email?: string; telefone?: string }> {
  const c = await asaas(`/customers/${encodeURIComponent(id)}`);
  return { nome: c.name, email: c.email, telefone: c.mobilePhone ?? c.phone };
}
