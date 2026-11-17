// Depois que o site grava a ficha (RPC enviar_ficha), pede este aviso só com o e-mail.
// A função procura a ficha recente desse e-mail ainda sem aviso e manda ao escritório nome e contato.
// Sem ficha recente, não faz nada: não serve para disparar e-mails à toa.
import { createClient } from "npm:@supabase/supabase-js@2";
import { cors, json, origemValida, texto } from "../_shared/http.ts";
import { avisarFicha } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return json(req, { erro: "método" }, 405);
  if (!origemValida(req)) return json(req, { erro: "origem" }, 403);

  const d = await req.json().catch(() => ({}));
  const email = texto(d.email, 200)?.toLowerCase();
  if (!email) return json(req, { ok: true });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const dezMin = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  // Marca antes de enviar, para não mandar dois avisos da mesma ficha.
  const { data: fichas } = await db.from("fichas_sessao").update({ email_enviado: true })
    .eq("email", email).eq("email_enviado", false).gte("criado_em", dezMin)
    .select("id, nome, email, whatsapp");
  if (!fichas?.length) return json(req, { ok: true });

  const f = fichas[0];
  const enviado = await avisarFicha(f.nome, f.email, f.whatsapp).catch((e) => (console.error(e), false));
  if (!enviado) await db.from("fichas_sessao").update({ email_enviado: false }).in("id", fichas.map((x) => x.id));
  return json(req, { ok: true });
});
