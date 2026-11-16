// Ação do painel (só admin): liga no link de pagamento da Sessão o retorno automático
// para /sessao/confirmado/. O Asaas não mostra essa opção na tela; só pela API.
import { createClient } from "npm:@supabase/supabase-js@2";
import { cors, json, origemValida } from "../_shared/http.ts";
import { asaas } from "../_shared/asaas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return json(req, { erro: "método" }, 405);
  if (!origemValida(req)) return json(req, { erro: "origem" }, 403);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(jwt);
  if (!u?.user) return json(req, { erro: "login" }, 401);
  const { data: adm } = await db.from("admins").select("user_id").eq("user_id", u.user.id).maybeSingle();
  if (!adm) return json(req, { erro: "acesso" }, 403);

  const d = await req.json().catch(() => ({}));
  const codigo = String(d.codigo ?? "").trim(); // final da URL do link: asaas.com/c/<codigo>
  if (!/^[a-z0-9]{6,40}$/i.test(codigo)) return json(req, { erro: "codigo" }, 422);
  const site = (Deno.env.get("SITE_URL") ?? "https://holdings.quintiliano.com.br").replace(/\/$/, "");

  try {
    // Procura o link pelo final da URL.
    let achado: any = null;
    for (let offset = 0; offset < 500 && !achado; offset += 100) {
      const pg = await asaas(`/paymentLinks?limit=100&offset=${offset}`);
      achado = (pg.data ?? []).find((l: any) => String(l.url ?? "").endsWith("/" + codigo) || l.id === codigo);
      if (!pg.hasMore) break;
    }
    if (!achado) return json(req, { erro: "link não encontrado" }, 404);

    const novo = await asaas(`/paymentLinks/${achado.id}`, {
      method: "PUT",
      body: JSON.stringify({ callback: { successUrl: `${site}/sessao/confirmado/`, autoRedirect: true } }),
    });
    return json(req, { ok: true, link_id: achado.id, nome: novo.name, retorno: `${site}/sessao/confirmado/` });
  } catch (e) {
    console.error(e);
    return json(req, { erro: String((e as Error).message ?? e).slice(0, 300) }, 502);
  }
});
