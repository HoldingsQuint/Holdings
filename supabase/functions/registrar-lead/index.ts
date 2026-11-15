// Recebe o formulário do checklist: valida, grava o contato e envia o e-mail.
import { createClient } from "npm:@supabase/supabase-js@2";
import { cors, json, origemValida, texto } from "../_shared/http.ts";
import { adicionarNaLista, enviarChecklist } from "../_shared/email.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return json(req, { erro: "método" }, 405);
  if (!origemValida(req)) return json(req, { erro: "origem" }, 403);

  let d: Record<string, unknown>;
  try {
    d = await req.json();
  } catch {
    return json(req, { erro: "dados" }, 400);
  }

  // Campo escondido: robôs preenchem, pessoas não. Responde ok sem gravar.
  if (texto(d.empresa, 50)) return json(req, { ok: true });

  const nome = texto(d.nome, 120);
  const email = texto(d.email, 200)?.toLowerCase() ?? null;
  const zap = typeof d.whatsapp === "string" ? d.whatsapp.replace(/\D/g, "") : "";
  const erros: string[] = [];
  if (!nome || nome.length < 2) erros.push("nome");
  if (!email || !EMAIL.test(email)) erros.push("email");
  if (zap.length < 10 || zap.length > 13) erros.push("whatsapp");
  if (d.consentimento !== true) erros.push("consentimento");
  if (erros.length) return json(req, { erro: "campos", campos: erros }, 422);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // Mesmo e-mail nos últimos 10 minutos: não duplica.
  const dezMin = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recente } = await db.from("leads").select("id").eq("email", email).gte("criado_em", dezMin).limit(1);
  if (recente && recente.length) return json(req, { ok: true, repetido: true });

  const { data: lead, error } = await db.from("leads").insert({
    nome,
    email,
    whatsapp: zap,
    consentimento_em: new Date().toISOString(),
    origem: texto(d.origem, 80) ?? "direto",
    campanha: texto(d.campanha, 120),
    midia: texto(d.midia, 80),
    conteudo: texto(d.conteudo, 120),
    pagina: texto(d.pagina, 120),
    dispositivo: d.dispositivo === "celular" ? "celular" : "computador",
  }).select("id").single();

  if (error) {
    console.error("insert lead", error);
    return json(req, { erro: "gravar" }, 500);
  }

  let enviado = false;
  try {
    enviado = await enviarChecklist(nome!, email!);
    await adicionarNaLista(nome!, email!);
    if (enviado) await db.from("leads").update({ email_enviado: true }).eq("id", lead.id);
  } catch (e) {
    console.error("email", e);
  }

  return json(req, { ok: true, email_enviado: enviado });
});
