// Recebe os avisos do Asaas. Confere o token, grava o pagamento, marca o contato como cliente
// e manda dois e-mails: confirmação para o cliente (com o link para marcar o horário) e aviso ao escritório.
// Responde 200 mesmo quando ignora o evento, para o Asaas não pausar a fila.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buscarCliente } from "../_shared/asaas.ts";
import { avisarEscritorio, confirmarPagamento } from "../_shared/email.ts";

const PAGOS = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"];
const IGUAIS = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};
const ok = (corpo: unknown = { ok: true }) =>
  new Response(JSON.stringify(corpo), { headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("método", { status: 405 });

  const esperado = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";
  const recebido = req.headers.get("asaas-access-token") ?? "";
  if (!esperado || !IGUAIS(recebido, esperado)) return new Response("token", { status: 401 });

  let d: Record<string, any>;
  try {
    d = await req.json();
  } catch {
    return ok({ ignorado: "corpo" });
  }
  const evento = String(d.event ?? "");
  const p = d.payment;
  if (!evento.startsWith("PAYMENT_") || !p?.id) return ok({ ignorado: evento });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // Só cobranças do link da Sessão (se ASAAS_LINK_ID estiver definido).
  const linkFiltro = Deno.env.get("ASAAS_LINK_ID");
  if (linkFiltro && p.paymentLink && p.paymentLink !== linkFiltro) return ok({ ignorado: "outro link" });

  const { data: existente } = await db.from("pagamentos").select("id, cliente_email").eq("asaas_id", p.id).maybeSingle();

  // Dados do cliente: só busca no Asaas na primeira vez.
  let cliente: { nome?: string; email?: string; telefone?: string } = {};
  if (!existente?.cliente_email && p.customer) {
    try {
      cliente = await buscarCliente(p.customer);
    } catch (e) {
      console.error("cliente asaas", e);
    }
  }

  const linha: Record<string, unknown> = {
    asaas_id: p.id,
    link_id: p.paymentLink ?? null,
    status: String(p.status ?? evento),
    ultimo_evento: evento,
    valor: typeof p.value === "number" ? p.value : null,
    forma: p.billingType ?? null,
    parcelas: p.installmentNumber ?? null,
    pago_em: p.confirmedDate ?? p.paymentDate ?? p.clientPaymentDate ?? null,
    atualizado_em: new Date().toISOString(),
  };
  if (cliente.email) {
    linha.cliente_nome = cliente.nome ?? null;
    linha.cliente_email = cliente.email.toLowerCase();
    linha.cliente_telefone = cliente.telefone ?? null;
  }

  const { data: pag, error } = await db.from("pagamentos").upsert(linha, { onConflict: "asaas_id" })
    .select("id, cliente_nome, cliente_email, cliente_telefone, lead_id, valor, forma").single();
  if (error) {
    console.error("gravar pagamento", error);
    return new Response("gravar", { status: 500 }); // o Asaas tenta de novo
  }

  if (!PAGOS.includes(evento)) return ok({ registrado: evento });

  // Contato do checklist com o mesmo e-mail vira "cliente".
  if (pag.cliente_email && !pag.lead_id) {
    const { data: lead } = await db.from("leads").select("id").eq("email", pag.cliente_email)
      .order("criado_em", { ascending: false }).limit(1).maybeSingle();
    if (lead) {
      await db.from("pagamentos").update({ lead_id: lead.id }).eq("id", pag.id);
      await db.from("leads").update({ status: "cliente" }).eq("id", lead.id);
    }
  }

  // Cada e-mail sai uma vez só: marca antes de enviar (o Asaas manda RECEIVED e CONFIRMED no cartão).
  const { data: vezCliente } = await db.from("pagamentos").update({ email_cliente_enviado: true })
    .eq("id", pag.id).eq("email_cliente_enviado", false).select("id");
  if (vezCliente?.length && pag.cliente_email) {
    const enviado = await confirmarPagamento(pag.cliente_nome ?? "", pag.cliente_email).catch((e) => (console.error(e), false));
    if (!enviado) await db.from("pagamentos").update({ email_cliente_enviado: false }).eq("id", pag.id);
  }

  const { data: vezEscritorio } = await db.from("pagamentos").update({ aviso_escritorio_enviado: true })
    .eq("id", pag.id).eq("aviso_escritorio_enviado", false).select("id");
  if (vezEscritorio?.length) {
    const enviado = await avisarEscritorio(pag).catch((e) => (console.error(e), false));
    if (!enviado) await db.from("pagamentos").update({ aviso_escritorio_enviado: false }).eq("id", pag.id);
  }

  return ok({ pago: true });
});
