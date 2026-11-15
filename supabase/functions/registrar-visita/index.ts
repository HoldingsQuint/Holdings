// Conta uma visita (só números: página, origem, campanha, dispositivo; nada que identifique a pessoa).
// Também responde ao "ping" diário do GitHub, que mantém o projeto gratuito ativo sem contar visita.
import { createClient } from "npm:@supabase/supabase-js@2";
import { cors, json, origemValida, texto } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return json(req, { erro: "método" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  let d: Record<string, unknown> = {};
  try {
    d = await req.json();
  } catch { /* corpo vazio */ }

  if (d.ping === true) {
    const { count } = await db.from("visitas").select("id", { count: "exact", head: true });
    return json(req, { ok: true, visitas: count ?? 0 });
  }

  if (!origemValida(req)) return json(req, { erro: "origem" }, 403);

  const pagina = texto(d.pagina, 120);
  if (!pagina) return json(req, { erro: "pagina" }, 422);

  const { error } = await db.from("visitas").insert({
    pagina,
    origem: texto(d.origem, 80) ?? "direto",
    campanha: texto(d.campanha, 120),
    dispositivo: d.dispositivo === "celular" ? "celular" : "computador",
  });
  if (error) {
    console.error("insert visita", error);
    return json(req, { erro: "gravar" }, 500);
  }
  return json(req, { ok: true });
});
