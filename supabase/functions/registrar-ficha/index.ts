// Recebe a ficha pré-sessão (página /sessao/confirmado/): valida, grava e avisa o escritório.
// O aviso por e-mail não leva os dados do patrimônio: só nome e contato; o resto fica no painel.
import { createClient } from "npm:@supabase/supabase-js@2";
import { cors, json, origemValida, texto } from "../_shared/http.ts";
import { avisarFicha } from "../_shared/email.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const OPCOES: Record<string, string[]> = {
  estado_civil: ["solteiro", "casado", "uniao_estavel", "divorciado", "viuvo"],
  regime_bens: ["comunhao_parcial", "comunhao_universal", "separacao_total", "participacao_final", "nao_sei"],
  imoveis: ["0", "1", "2-5", "6-10", "10+"],
  valor_imoveis: ["ate_1mi", "1_3mi", "3_10mi", "10mi+", "nao_informar"],
  investimentos: ["nenhum", "ate_500mil", "500mil_2mi", "2mi+", "nao_informar"],
};
const OBJETIVOS = ["sucessao", "impostos", "protecao", "inventario", "gestao", "empresa", "outro"];

function opcao(v: unknown, campo: string): string | null {
  return typeof v === "string" && OPCOES[campo].includes(v) ? v : null;
}
function simNao(v: unknown): boolean | null {
  return v === true || v === "sim" ? true : v === false || v === "nao" ? false : null;
}

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
  if (texto(d.empresa_site, 50)) return json(req, { ok: true }); // isca

  const nome = texto(d.nome, 120);
  const email = texto(d.email, 200)?.toLowerCase() ?? null;
  const zap = typeof d.whatsapp === "string" ? d.whatsapp.replace(/\D/g, "") : "";
  const erros: string[] = [];
  if (!nome || nome.length < 2) erros.push("nome");
  if (!email || !EMAIL.test(email)) erros.push("email");
  if (zap.length < 10 || zap.length > 13) erros.push("whatsapp");
  if (d.consentimento !== true) erros.push("consentimento");
  if (erros.length) return json(req, { erro: "campos", campos: erros }, 422);

  const herdeiros = Number.isInteger(d.herdeiros) && (d.herdeiros as number) >= 0 && (d.herdeiros as number) <= 50
    ? d.herdeiros as number : null;
  const objetivos = Array.isArray(d.objetivos) ? d.objetivos.filter((o) => OBJETIVOS.includes(o as string)) as string[] : [];

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // Mesmo e-mail nos últimos 2 minutos: evita duplicar por clique repetido.
  const doisMin = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: recente } = await db.from("fichas_sessao").select("id").eq("email", email).gte("criado_em", doisMin).limit(1);
  if (recente && recente.length) return json(req, { ok: true, repetido: true });

  const { data: ficha, error } = await db.from("fichas_sessao").insert({
    nome,
    email,
    whatsapp: zap,
    estado_civil: opcao(d.estado_civil, "estado_civil"),
    regime_bens: opcao(d.regime_bens, "regime_bens"),
    herdeiros,
    herdeiro_menor: simNao(d.herdeiro_menor),
    filhos_relacoes_diferentes: simNao(d.filhos_relacoes_diferentes),
    imoveis: opcao(d.imoveis, "imoveis"),
    valor_imoveis: opcao(d.valor_imoveis, "valor_imoveis"),
    aluguel: simNao(d.aluguel),
    empresa: simNao(d.empresa),
    empresa_descricao: texto(d.empresa_descricao, 500),
    rural: simNao(d.rural),
    investimentos: opcao(d.investimentos, "investimentos"),
    objetivos,
    observacoes: typeof d.observacoes === "string" ? d.observacoes.trim().slice(0, 3000) || null : null,
    consentimento_em: new Date().toISOString(),
  }).select("id").single();
  if (error) {
    console.error("insert ficha", error);
    return json(req, { erro: "gravar" }, 500);
  }

  try {
    const enviado = await avisarFicha(nome!, email!, zap);
    if (enviado) await db.from("fichas_sessao").update({ email_enviado: true }).eq("id", ficha.id);
  } catch (e) {
    console.error("email ficha", e);
  }
  return json(req, { ok: true });
});
