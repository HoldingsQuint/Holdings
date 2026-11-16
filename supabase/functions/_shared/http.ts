// CORS e respostas JSON. Origens aceitas vêm de ALLOWED_ORIGINS (separadas por vírgula).
const PADRAO = [
  "https://holdings.quintiliano.com.br",
  "https://holdingsquint.github.io",
  "http://localhost:8080",
];

function origensPermitidas(): string[] {
  const env = Deno.env.get("ALLOWED_ORIGINS");
  return env ? env.split(",").map((s) => s.trim()).filter(Boolean) : PADRAO;
}

export function cors(req: Request): Record<string, string> {
  const origem = req.headers.get("origin") ?? "";
  const lista = origensPermitidas();
  return {
    "Access-Control-Allow-Origin": lista.includes(origem) ? origem : lista[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Vary": "Origin",
  };
}

export function origemValida(req: Request): boolean {
  const origem = req.headers.get("origin");
  return !!origem && origensPermitidas().includes(origem);
}

export function json(req: Request, corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

export function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t ? t.slice(0, max) : null;
}
