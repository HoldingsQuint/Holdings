// Painel: login, números do período, contatos e mudança de situação.
// A segurança está no banco (RLS): só quem está na tabela admins lê alguma coisa.
(function () {
  // Não deixa o painel abrir dentro de outro site (clickjacking).
  if (window.top !== window.self) { document.documentElement.style.display = "none"; window.top.location = window.self.location; return; }
  var S = window.SITE;
  var db = window.supabase.createClient(S.supabaseUrl, S.supabaseKey);
  var dias = 30;
  var contatos = [];
  var SITUACOES = { novo: "Novo", em_contato: "Em contato", sessao_agendada: "Sessão agendada", cliente: "Cliente", descartado: "Descartado" };

  function $(id) { return document.getElementById(id); }
  function mostrar(tela) {
    ["tela-login", "tela-negado", "tela-painel"].forEach(function (t) { $(t).classList.toggle("oculto", t !== tela); });
    $("sair").classList.toggle("oculto", tela === "tela-login");
  }
  function el(tag, texto, classe) {
    var e = document.createElement(tag);
    if (texto !== undefined && texto !== null) e.textContent = texto;
    if (classe) e.className = classe;
    return e;
  }
  function pct(a, b) { return b ? (100 * a / b).toFixed(1).replace(".", ",") + "%" : "–"; }
  function data(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function zapFmt(n) {
    var d = String(n).replace(/^55/, "");
    return d.length === 11 ? "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7) : d;
  }
  function inicio() {
    var d = new Date();
    if (dias === 1) { d.setHours(0, 0, 0, 0); return d.toISOString(); }
    d.setDate(d.getDate() - dias);
    return d.toISOString();
  }

  async function sessao() {
    var r = await db.auth.getSession();
    var s = r.data.session;
    if (!s) return mostrar("tela-login");
    var a = await db.from("admins").select("user_id").eq("user_id", s.user.id).maybeSingle();
    if (!a.data) return mostrar("tela-negado");
    mostrar("tela-painel");
    agenda("AGENDA");
    carregar();
  }

  async function carregar() {
    var desde = inicio();
    var rv = await db.from("visitas").select("pagina, origem, dispositivo").gte("criado_em", desde).limit(20000);
    var rl = await db.from("leads").select("id, criado_em, nome, email, whatsapp, origem, campanha, email_enviado, status").gte("criado_em", desde).order("criado_em", { ascending: false }).limit(5000);
    var rp = await db.from("pagamentos").select("criado_em, cliente_nome, cliente_email, cliente_telefone, valor, forma, status").gte("criado_em", desde).order("criado_em", { ascending: false }).limit(1000);
    pagamentos(rp.data || []);
    var rf = await db.from("fichas_sessao").select("*").gte("criado_em", desde).order("criado_em", { ascending: false }).limit(500);
    fichas(rf.data || [], rp.data || []);
    var visitas = rv.data || [];
    contatos = rl.data || [];

    var naHome = visitas.filter(function (v) { return v.pagina === "/"; });
    $("k-visitas").textContent = visitas.length;
    $("k-contatos").textContent = contatos.length;
    $("k-conversao").textContent = pct(contatos.length, naHome.length);
    $("k-sessoes").textContent = contatos.filter(function (c) { return c.status === "sessao_agendada" || c.status === "cliente"; }).length;

    // Por origem (visitas na página inicial x contatos)
    var origens = {};
    naHome.forEach(function (v) { var o = v.origem || "direto"; (origens[o] = origens[o] || { v: 0, c: 0 }).v++; });
    contatos.forEach(function (c) { var o = c.origem || "direto"; (origens[o] = origens[o] || { v: 0, c: 0 }).c++; });
    var tbo = $("t-origem"); tbo.textContent = "";
    var lista = Object.keys(origens).sort(function (a, b) { return origens[b].v - origens[a].v; });
    if (!lista.length) { var tr0 = el("tr"); var td0 = el("td", "Sem dados no período.", "vazio"); td0.colSpan = 4; tr0.appendChild(td0); tbo.appendChild(tr0); }
    lista.forEach(function (o) {
      var tr = el("tr");
      tr.appendChild(el("td", o));
      tr.appendChild(el("td", origens[o].v, "num"));
      tr.appendChild(el("td", origens[o].c, "num"));
      tr.appendChild(el("td", pct(origens[o].c, origens[o].v), "num"));
      tbo.appendChild(tr);
    });

    // Por página
    var paginas = {};
    visitas.forEach(function (v) { var p = paginas[v.pagina] = paginas[v.pagina] || { t: 0, cel: 0 }; p.t++; if (v.dispositivo === "celular") p.cel++; });
    var tbp = $("t-pagina"); tbp.textContent = "";
    var lp = Object.keys(paginas).sort(function (a, b) { return paginas[b].t - paginas[a].t; });
    if (!lp.length) { var tr1 = el("tr"); var td1 = el("td", "Sem dados no período.", "vazio"); td1.colSpan = 3; tr1.appendChild(td1); tbp.appendChild(tr1); }
    lp.forEach(function (p) {
      var tr = el("tr");
      tr.appendChild(el("td", p));
      tr.appendChild(el("td", paginas[p].t, "num"));
      tr.appendChild(el("td", pct(paginas[p].cel, paginas[p].t), "num"));
      tbp.appendChild(tr);
    });

    // Contatos
    var tbc = $("t-contatos"); tbc.textContent = "";
    if (!contatos.length) { var tr2 = el("tr"); var td2 = el("td", "Nenhum contato no período.", "vazio"); td2.colSpan = 7; tr2.appendChild(td2); tbc.appendChild(tr2); }
    contatos.forEach(function (c) {
      var tr = el("tr");
      tr.appendChild(el("td", data(c.criado_em)));
      tr.appendChild(el("td", c.nome));
      var tdE = el("td"); var aE = el("a", c.email); aE.href = "mailto:" + c.email; tdE.appendChild(aE); tr.appendChild(tdE);
      var tdZ = el("td"); var aZ = el("a", zapFmt(c.whatsapp));
      aZ.href = "https://wa.me/" + c.whatsapp + "?text=" + encodeURIComponent("Olá, " + c.nome.split(" ")[0] + "! Aqui é da Holdings Quintiliano. Vi que você pediu o checklist sobre holding familiar.");
      aZ.target = "_blank"; aZ.rel = "noopener"; tdZ.appendChild(aZ); tr.appendChild(tdZ);
      tr.appendChild(el("td", (c.origem || "direto") + (c.campanha ? " · " + c.campanha : "")));
      tr.appendChild(el("td", c.email_enviado ? "Sim" : "Não"));
      var tdS = el("td"); var sel = el("select");
      Object.keys(SITUACOES).forEach(function (k) { var op = el("option", SITUACOES[k]); op.value = k; if (k === c.status) op.selected = true; sel.appendChild(op); });
      sel.addEventListener("change", async function () {
        sel.disabled = true;
        var r = await db.from("leads").update({ status: sel.value }).eq("id", c.id);
        sel.disabled = false;
        if (r.error) { alertaErro(); sel.value = c.status; } else { c.status = sel.value; }
      });
      tdS.appendChild(sel); tr.appendChild(tdS);
      tbc.appendChild(tr);
    });
  }

  var STATUS_PAG = { RECEIVED: "Pago", CONFIRMED: "Pago", RECEIVED_IN_CASH: "Pago", PENDING: "Aguardando", OVERDUE: "Vencido", REFUNDED: "Estornado", REFUND_REQUESTED: "Estorno pedido", CHARGEBACK_REQUESTED: "Contestação", DELETED: "Removido" };
  function pagamentos(lista) {
    var t = $("t-pagamentos"); t.innerHTML = "";
    if (!lista.length) { var tr = el("tr"); var td = el("td", "Nenhum pagamento no período.", "vazio"); td.colSpan = 7; tr.appendChild(td); t.appendChild(tr); return; }
    lista.forEach(function (p) {
      var tr = el("tr");
      tr.appendChild(el("td", data(p.criado_em)));
      tr.appendChild(el("td", p.cliente_nome || "–"));
      tr.appendChild(el("td", p.cliente_email || "–"));
      tr.appendChild(el("td", p.cliente_telefone || "–"));
      tr.appendChild(el("td", p.valor != null ? Number(p.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "–", "num"));
      tr.appendChild(el("td", { PIX: "Pix", CREDIT_CARD: "Cartão", BOLETO: "Boleto" }[p.forma] || p.forma || "–"));
      tr.appendChild(el("td", STATUS_PAG[p.status] || p.status));
      t.appendChild(tr);
    });
  }

  var ROTULOS = {
    estado_civil: { solteiro: "Solteiro(a)", casado: "Casado(a)", uniao_estavel: "União estável", divorciado: "Divorciado(a)", viuvo: "Viúvo(a)" },
    regime_bens: { comunhao_parcial: "Comunhão parcial", comunhao_universal: "Comunhão universal", separacao_total: "Separação total", participacao_final: "Participação final nos aquestos", nao_sei: "Não sabe" },
    imoveis: { "0": "Nenhum", "1": "1", "2-5": "2 a 5", "6-10": "6 a 10", "10+": "Mais de 10" },
    valor_imoveis: { ate_500mil: "Até R$ 500 mil", "500mil_1mi": "R$ 500 mil a 1 mi", ate_1mi: "Até R$ 1 mi", "1_3mi": "R$ 1 a 3 mi", "3_10mi": "R$ 3 a 10 mi", "10mi+": "Mais de R$ 10 mi", nao_sei: "Não sabe", nao_informar: "Não informou" },
    investimentos: { nenhum: "Nenhum relevante", ate_500mil: "Até R$ 500 mil", "500mil_2mi": "R$ 500 mil a 2 mi", "2mi+": "Mais de R$ 2 mi", nao_informar: "Não informou" },
    objetivos: { sucessao: "Sucessão", impostos: "Impostos", protecao: "Proteção do patrimônio", inventario: "Evitar inventário", gestao: "Gestão dos bens", empresa: "Sucessão da empresa", outro: "Outro" },
  };
  function sn(v) { return v === true ? "Sim" : v === false ? "Não" : "–"; }
  function fichas(lista, pags) {
    var box = $("fichas"); box.innerHTML = "";
    if (!lista.length) { box.appendChild(el("p", "Nenhuma ficha no período.", "nota")); return; }
    var pagos = {};
    pags.forEach(function (p) { if (p.cliente_email) pagos[p.cliente_email.toLowerCase()] = true; });
    lista.forEach(function (f) {
      var d = el("details"); d.style.borderTop = "1px solid #e6ebf1"; d.style.padding = "10px 0";
      var sm = el("summary"); sm.style.cursor = "pointer";
      sm.appendChild(el("strong", f.nome));
      sm.appendChild(document.createTextNode(" · " + data(f.criado_em) + " · " + (pagos[f.email.toLowerCase()] ? "pagou" : "pagamento não encontrado")));
      d.appendChild(sm);
      var linhas = [
        ["E-mail", f.email], ["WhatsApp", zapFmt(f.whatsapp)],
        ["Estado civil", (ROTULOS.estado_civil[f.estado_civil] || "–") + (f.regime_bens ? " · " + (ROTULOS.regime_bens[f.regime_bens] || f.regime_bens) : "")],
        ["Herdeiros", (f.herdeiros != null ? f.herdeiros : "–") + " · menor de idade: " + sn(f.herdeiro_menor) + " · filhos de relações diferentes: " + sn(f.filhos_relacoes_diferentes)],
        ["Imóveis", (ROTULOS.imoveis[f.imoveis] || "–") + " · aluguel: " + sn(f.aluguel)],
        ["Valor no IR", ROTULOS.valor_imoveis[f.valor_imoveis_ir] || "–"],
        ["Valor de mercado", ROTULOS.valor_imoveis[f.valor_imoveis] || "–"],
        ["Rural / agro", sn(f.rural)],
        ["Empresa", sn(f.empresa) + (f.empresa_descricao ? " · " + f.empresa_descricao : "")],
        ["Investimentos", ROTULOS.investimentos[f.investimentos] || "–"],
        ["Objetivos", (f.objetivos || []).map(function (o) { return ROTULOS.objetivos[o] || o; }).join(", ") || "–"],
        ["Observações", f.observacoes || "–"],
      ];
      var t = el("table"); t.style.marginTop = "8px";
      linhas.forEach(function (l) {
        var tr = el("tr"); var a = el("td", l[0]); a.style.color = "var(--texto-suave)"; a.style.width = "140px";
        var b = el("td", String(l[1])); b.style.whiteSpace = "pre-wrap";
        tr.appendChild(a); tr.appendChild(b); t.appendChild(tr);
      });
      d.appendChild(t);
      box.appendChild(d);
    });
  }

  // Agenda do Google onde caem as reservas da página de agendamento.
  var AGENDA = "holdingsquintiliano@gmail.com";
  function agenda(modo) {
    var src = "https://calendar.google.com/calendar/embed?src=" + encodeURIComponent(AGENDA) +
      "&ctz=America%2FSao_Paulo&hl=pt_BR&mode=" + modo + "&showTitle=0&showPrint=0&showCalendars=0&showTz=0";
    $("agenda").src = src;
  }

  async function ligarRetorno() {
    var erro = $("erro-asaas"), okk = $("ok-asaas"), b = $("b-asaas");
    erro.classList.remove("visivel"); okk.classList.add("oculto");
    function cod(u) { return String(u || "").split("?")[0].replace(/\/$/, "").split("/").pop(); }
    var codigos = [cod(S.linkPagamento), cod(S.linkPagamentoVista)].filter(Boolean);
    var codigo = codigos[0];
    var s = (await db.auth.getSession()).data.session;
    if (!s || !codigo) { erro.textContent = "Entre de novo e confira o link de pagamento no config."; erro.classList.add("visivel"); return; }
    b.disabled = true;
    try {
      var j = {};
      for (var i = 0; i < codigos.length; i++) {
        var r = await fetch(S.supabaseUrl + "/functions/v1/asaas-config", {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: S.supabaseKey, Authorization: "Bearer " + s.access_token },
          body: JSON.stringify({ codigo: codigos[i] }),
        });
        j = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error((j.erro || ("erro " + r.status)) + " (link " + (i + 1) + ")");
      }
      okk.textContent = "Pronto (" + codigos.length + " links). Depois de pagar, o cliente vai para " + j.retorno;
      okk.classList.remove("oculto");
    } catch (e) {
      erro.textContent = "Não deu certo: " + e.message;
      erro.classList.add("visivel");
    } finally { b.disabled = false; }
  }

  function alertaErro() { console.error("Não foi possível salvar a situação."); }

  function exportar() {
    var linhas = [["data", "nome", "email", "whatsapp", "origem", "campanha", "email_enviado", "situacao"]];
    contatos.forEach(function (c) { linhas.push([c.criado_em, c.nome, c.email, c.whatsapp, c.origem || "", c.campanha || "", c.email_enviado ? "sim" : "nao", SITUACOES[c.status] || c.status]); });
    var csv = linhas.map(function (l) { return l.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(";"); }).join("\n");
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "contatos-holdings-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var comSenha = false;
    $("alternar").addEventListener("click", function (e) {
      e.preventDefault();
      comSenha = !comSenha;
      $("campo-senha").classList.toggle("oculto", !comSenha);
      $("l-senha").required = comSenha;
      $("b-entrar").textContent = comSenha ? "Entrar" : "Receber link de acesso por e-mail";
      this.textContent = comSenha ? "Receber link por e-mail" : "Entrar com senha";
    });

    $("form-login").addEventListener("submit", async function (e) {
      e.preventDefault();
      var erro = $("erro-login"); erro.classList.remove("visivel");
      var ok = $("ok-login"); ok.classList.add("oculto");
      var email = $("l-email").value.trim();
      var botao = $("b-entrar"); botao.disabled = true;
      if (comSenha) {
        var r = await db.auth.signInWithPassword({ email: email, password: $("l-senha").value });
        botao.disabled = false;
        if (r.error) { erro.textContent = "E-mail ou senha incorretos. Se ainda não criou senha, use o link por e-mail."; erro.classList.add("visivel"); return; }
        return; // a sessão abre pelo onAuthStateChange
      }
      // Link de acesso: só para contas já cadastradas (não cria conta nova).
      var volta = location.origin + location.pathname;
      var r2 = await db.auth.signInWithOtp({ email: email, options: { shouldCreateUser: false, emailRedirectTo: volta } });
      botao.disabled = false;
      if (r2.error && /rate|limit/i.test(r2.error.message)) {
        erro.textContent = "Muitos pedidos de link em pouco tempo. Espere alguns minutos e tente de novo.";
        erro.classList.add("visivel");
        return;
      }
      // Resposta igual para e-mail cadastrado ou não, para não revelar quem tem acesso.
      ok.textContent = "Se este e-mail tiver acesso, o link chega em instantes. Abra pelo mesmo navegador ou pelo celular.";
      ok.classList.remove("oculto");
    });

    $("form-senha").addEventListener("submit", async function (e) {
      e.preventDefault();
      var erro = $("erro-senha"); erro.classList.remove("visivel");
      $("ok-senha").classList.add("oculto");
      var a = $("s-nova").value, b = $("s-conf").value;
      if (a.length < 8) { erro.textContent = "Use pelo menos 8 caracteres."; erro.classList.add("visivel"); return; }
      if (a !== b) { erro.textContent = "As senhas não são iguais."; erro.classList.add("visivel"); return; }
      var r = await db.auth.updateUser({ password: a });
      if (r.error) { erro.textContent = "Não foi possível salvar: " + r.error.message; erro.classList.add("visivel"); return; }
      this.reset();
      $("ok-senha").classList.remove("oculto");
    });

    // Volta do link de acesso: o Supabase lê o token do endereço e abre a sessão.
    db.auth.onAuthStateChange(function (evento) {
      if (evento === "SIGNED_IN") { history.replaceState(null, "", location.pathname); sessao(); }
    });
    $("sair").addEventListener("click", async function () { await db.auth.signOut(); mostrar("tela-login"); });
    $("filtros").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      dias = Number(b.getAttribute("data-dias"));
      this.querySelectorAll("button").forEach(function (x) { x.classList.toggle("ativo", x === b); });
      carregar();
    });
    $("exportar").addEventListener("click", exportar);
    $("b-asaas").addEventListener("click", ligarRetorno);
    $("modo-agenda").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      this.querySelectorAll("button").forEach(function (x) { x.classList.toggle("ativo", x === b); });
      agenda(b.getAttribute("data-modo"));
    });
    sessao();
  });
})();
