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
