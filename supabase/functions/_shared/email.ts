// Envio pelo Resend. Sem RESEND_API_KEY nos segredos, não envia e avisa no retorno.
const API = "https://api.resend.com";

function chave(): string | null {
  return Deno.env.get("RESEND_API_KEY") ?? null;
}

function escapar(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export async function enviarChecklist(nome: string, email: string): Promise<boolean> {
  const key = chave();
  if (!key) return false;
  const site = Deno.env.get("SITE_URL") ?? "https://holdings.quintiliano.com.br";
  const de = Deno.env.get("RESEND_FROM") ?? "Holdings Quintiliano <contato@holdings.quintiliano.com.br>";
  const primeiro = escapar(nome.split(" ")[0]);
  const link = `${site}/checklist/`;
  const sessao = `${site}/sessao/`;

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#14243a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 0"><tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden">
  <tr><td style="background:#0f2a4a;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold">Holdings Quintiliano</td></tr>
  <tr><td style="padding:28px">
  <p style="font-size:16px;margin:0 0 16px">Olá, ${primeiro}.</p>
  <p style="font-size:16px;line-height:1.5;margin:0 0 16px">Aqui está o seu checklist <strong>"Sua família precisa de uma holding?"</strong>. São 12 perguntas rápidas para ver se vale a pena estudar o assunto com calma.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#1f5fae;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:6px;font-weight:bold;display:inline-block">Abrir o checklist</a></p>
  <p style="font-size:15px;line-height:1.5;margin:0 0 16px">Se, no fim, a resposta for "vale olhar com atenção", a <a href="${sessao}" style="color:#1f5fae">Sessão de Viabilidade</a> é uma conversa individual para analisar o seu caso.</p>
  <p style="font-size:13px;line-height:1.5;color:#5b6b80;margin:24px 0 0">Este material é informativo e não substitui a análise de um advogado sobre o seu caso.</p>
  </td></tr></table>
  <p style="font-size:12px;color:#7a889a;margin:16px 0 0">Você recebeu este e-mail porque pediu o checklist em ${escapar(site.replace("https://", ""))}.</p>
  </td></tr></table></body></html>`;

  const texto = `Olá, ${nome.split(" ")[0]}.\n\nAqui está o seu checklist "Sua família precisa de uma holding?": ${link}\n\nSe quiser analisar o seu caso, conheça a Sessão de Viabilidade: ${sessao}\n\nEste material é informativo e não substitui a análise de um advogado sobre o seu caso.`;

  const r = await fetch(`${API}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: de,
      to: [email],
      // Respostas vão para o Paulo; cópia oculta de cada envio para a caixa das holdings.
      reply_to: (Deno.env.get("RESEND_REPLY_TO") ?? "paulo@quintiliano.adv.br").split(",").map((x) => x.trim()).filter(Boolean),
      bcc: (Deno.env.get("RESEND_BCC") ?? "holdingsquintiliano@gmail.com").split(",").map((x) => x.trim()).filter(Boolean),
      subject: "Seu checklist: sua família precisa de uma holding?",
      html,
      text: texto,
    }),
  });
  if (!r.ok) console.error("resend emails", r.status, await r.text());
  return r.ok;
}

// Coloca o contato na lista do Resend (para os e-mails seguintes). Opcional: RESEND_AUDIENCE_ID.
export async function adicionarNaLista(nome: string, email: string): Promise<void> {
  const key = chave();
  const lista = Deno.env.get("RESEND_AUDIENCE_ID");
  if (!key || !lista) return;
  const r = await fetch(`${API}/audiences/${lista}/contacts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, first_name: nome.split(" ")[0], unsubscribed: false }),
  });
  if (!r.ok) console.error("resend contacts", r.status, await r.text());
}

// ---- Pagamento da Sessão ----
function listaEnv(nome: string, padrao: string): string[] {
  return (Deno.env.get(nome) ?? padrao).split(",").map((x) => x.trim()).filter(Boolean);
}

async function enviar(corpo: Record<string, unknown>): Promise<boolean> {
  const key = chave();
  if (!key) return false;
  const r = await fetch(`${API}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("RESEND_FROM") ?? "Holdings Quintiliano <contato@holdings.quintiliano.com.br>", ...corpo }),
  });
  if (!r.ok) console.error("resend emails", r.status, await r.text());
  return r.ok;
}

function moldura(conteudo: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#14243a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 0"><tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden">
  <tr><td style="background:#0f2a4a;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:bold">Holdings Quintiliano</td></tr>
  <tr><td style="padding:28px">${conteudo}</td></tr></table></td></tr></table></body></html>`;
}

// Para o cliente: pagamento recebido e link para marcar a entrevista.
export async function confirmarPagamento(nome: string, email: string): Promise<boolean> {
  const site = Deno.env.get("SITE_URL") ?? "https://holdings.quintiliano.com.br";
  const link = `${site}/sessao/confirmado/`;
  const primeiro = (nome || "").split(" ")[0];
  const html = moldura(`
  <p style="font-size:16px;margin:0 0 16px">Olá${primeiro ? ", " + escapar(primeiro) : ""}.</p>
  <p style="font-size:16px;line-height:1.5;margin:0 0 16px">Recebemos o pagamento da sua <strong>Sessão de Viabilidade</strong>. O próximo passo é marcar o dia e o horário da entrevista, que dura cerca de 2 horas.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#1f5fae;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:6px;font-weight:bold;display:inline-block">Marcar o horário</a></p>
  <p style="font-size:15px;line-height:1.5;margin:0 0 16px">Depois da entrevista, você envia os documentos pedidos e recebe o Relatório Técnico de Viabilidade. Se tiver qualquer dúvida, é só responder este e-mail.</p>`);
  const texto = `Olá${primeiro ? ", " + primeiro : ""}.\n\nRecebemos o pagamento da sua Sessão de Viabilidade. Marque o dia e o horário da entrevista (cerca de 2 horas): ${link}\n\nDepois da entrevista, você envia os documentos pedidos e recebe o Relatório Técnico de Viabilidade. Dúvidas: responda este e-mail.`;
  return enviar({
    to: [email],
    reply_to: listaEnv("RESEND_REPLY_TO", "paulo@quintiliano.adv.br"),
    bcc: listaEnv("RESEND_BCC", "holdingsquintiliano@gmail.com"),
    subject: "Pagamento recebido: marque a sua Sessão de Viabilidade",
    html,
    text: texto,
  });
}

// Para o escritório: nova Sessão paga.
export async function avisarEscritorio(p: { cliente_nome?: string | null; cliente_email?: string | null; cliente_telefone?: string | null; valor?: number | null; forma?: string | null }): Promise<boolean> {
  const valor = typeof p.valor === "number" ? p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "–";
  const linhas = [
    ["Cliente", p.cliente_nome ?? "–"],
    ["E-mail", p.cliente_email ?? "–"],
    ["Telefone", p.cliente_telefone ?? "–"],
    ["Valor", valor],
    ["Forma", p.forma ?? "–"],
  ];
  const html = moldura(`<p style="font-size:16px;margin:0 0 16px"><strong>Nova Sessão de Viabilidade paga.</strong></p>
  <table cellpadding="6" style="font-size:15px">${linhas.map(([a, b]) => `<tr><td style="color:#5b6b80">${a}</td><td>${escapar(String(b))}</td></tr>`).join("")}</table>
  <p style="font-size:14px;color:#5b6b80;margin:16px 0 0">O cliente recebeu o link para marcar o horário. Detalhes no painel e no Asaas.</p>`);
  return enviar({
    to: listaEnv("AVISO_PAGAMENTO_PARA", "paulo@quintiliano.adv.br,holdingsquintiliano@gmail.com"),
    subject: `Sessão paga: ${p.cliente_nome ?? "novo cliente"}`,
    html,
    text: linhas.map(([a, b]) => `${a}: ${b}`).join("\n"),
  });
}
