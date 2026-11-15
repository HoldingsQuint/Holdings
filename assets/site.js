// Comportamento comum: dados da configuração, origem da visita (UTM), contador de visitas,
// formulário do checklist e pixel da Meta. Sem cookies e sem dados que identifiquem quem só visita.
(function () {
  var S = window.SITE || {};
  var FUNCOES = (S.supabaseUrl || "") + "/functions/v1/";
  var ROTULOS = {
    oab: "OAB", whatsapp: "WhatsApp", email: "e-mail de contato", escritorio: "nome do escritório",
    cnpj: "CNPJ", precoSessao: "preço", duracaoSessao: "duração", advogado: "nome do advogado", cidade: "cidade",
  };

  function pendente(chave) {
    var s = document.createElement("span");
    s.className = "pendente";
    s.textContent = "pendente: " + (ROTULOS[chave] || chave);
    return s;
  }

  // Origem da visita: primeiro toque da sessão.
  function origem() {
    try {
      var salvo = sessionStorage.getItem("hq_origem");
      if (salvo) return JSON.parse(salvo);
    } catch (e) { /* navegação privada */ }
    var p = new URLSearchParams(location.search);
    var ref = "";
    try { ref = document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) { ref = ""; }
    var porRef = !ref || ref === location.hostname ? "direto"
      : /instagram/.test(ref) ? "instagram"
      : /facebook|fb\./.test(ref) ? "facebook"
      : /google\./.test(ref) ? "google"
      : /youtube/.test(ref) ? "youtube"
      : /whatsapp|wa\.me/.test(ref) ? "whatsapp"
      : ref;
    var o = {
      origem: (p.get("utm_source") || porRef).toLowerCase().slice(0, 80),
      campanha: p.get("utm_campaign") || null,
      midia: p.get("utm_medium") || null,
      conteudo: p.get("utm_content") || null,
    };
    try { sessionStorage.setItem("hq_origem", JSON.stringify(o)); } catch (e) { /* ok */ }
    return o;
  }

  function dispositivo() {
    return window.matchMedia("(max-width: 820px)").matches || /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "celular" : "computador";
  }

  function local() {
    return location.protocol === "file:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  }

  function post(funcao, corpo) {
    return fetch(FUNCOES + funcao, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: S.supabaseKey },
      body: JSON.stringify(corpo),
    });
  }

  // Uma visita por página por sessão; não conta testes no computador local.
  function registrarVisita() {
    var pagina = document.body.getAttribute("data-pagina");
    if (!pagina || local()) return;
    var chave = "hq_visita_" + pagina;
    try { if (sessionStorage.getItem(chave)) return; sessionStorage.setItem(chave, "1"); } catch (e) { /* ok */ }
    var o = origem();
    post("registrar-visita", { pagina: pagina, origem: o.origem, campanha: o.campanha, dispositivo: dispositivo() }).catch(function () {});
  }

  function preencherConfig() {
    document.querySelectorAll("[data-config]").forEach(function (el) {
      var chave = el.getAttribute("data-config");
      var v = S[chave];
      if (v) el.textContent = v; else { el.textContent = ""; el.appendChild(pendente(chave)); }
    });
    document.querySelectorAll("[data-zap]").forEach(function (el) {
      var msg = el.getAttribute("data-zap") || "Olá! Vim pelo site das holdings.";
      if (S.whatsapp) {
        el.href = "https://wa.me/" + S.whatsapp + "?text=" + encodeURIComponent(msg);
        el.target = "_blank";
        el.rel = "noopener";
      } else {
        el.href = "#";
        el.title = "WhatsApp ainda não configurado";
        el.addEventListener("click", function (e) { e.preventDefault(); });
        el.appendChild(document.createTextNode(" "));
        el.appendChild(pendente("whatsapp"));
      }
    });
    document.querySelectorAll("[data-link]").forEach(function (el) {
      var chave = el.getAttribute("data-link");
      var v = S[chave];
      if (v) { el.href = v; el.target = "_blank"; el.rel = "noopener"; return; }
      // Sem link configurado: cai no WhatsApp, para ninguém ficar sem caminho.
      var msg = el.getAttribute("data-link-zap");
      if (msg && S.whatsapp) {
        el.href = "https://wa.me/" + S.whatsapp + "?text=" + encodeURIComponent(msg);
        el.target = "_blank"; el.rel = "noopener";
      } else {
        el.href = "#";
        el.addEventListener("click", function (e) { e.preventDefault(); });
        el.appendChild(document.createTextNode(" "));
        el.appendChild(pendente(chave === "linkPagamento" ? "link de pagamento" : "link da agenda"));
      }
    });
    document.querySelectorAll("[data-ano]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  function pixel() {
    if (!S.metaPixel || local()) return;
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    window.fbq("init", S.metaPixel);
    window.fbq("track", "PageView");
    var evento = document.body.getAttribute("data-evento");
    if (evento) window.fbq("track", evento);
  }

  // Formulário do checklist.
  function formularios() {
    document.querySelectorAll("form[data-form-lead]").forEach(function (form) {
      var zap = form.querySelector('[name="whatsapp"]');
      if (zap) zap.addEventListener("input", function () {
        var d = zap.value.replace(/\D/g, "").slice(0, 11);
        zap.value = d.length > 6 ? "(" + d.slice(0, 2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(-4)
          : d.length > 2 ? "(" + d.slice(0, 2) + ") " + d.slice(2) : d;
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var erroGeral = form.querySelector(".form-erro");
        erroGeral.classList.remove("visivel");
        form.querySelectorAll(".invalido").forEach(function (c) { c.classList.remove("invalido"); });

        var nome = form.nome.value.trim();
        var email = form.email.value.trim();
        var whats = form.whatsapp.value.replace(/\D/g, "");
        var aceite = form.consentimento.checked;
        var ok = true;
        if (nome.length < 2) { form.nome.closest(".campo").classList.add("invalido"); ok = false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { form.email.closest(".campo").classList.add("invalido"); ok = false; }
        if (whats.length < 10 || whats.length > 11) { form.whatsapp.closest(".campo").classList.add("invalido"); ok = false; }
        if (!aceite) { form.consentimento.closest(".consentimento").classList.add("invalido"); ok = false; }
        if (!ok) return;

        var botao = form.querySelector("button[type=submit]");
        var textoBotao = botao.textContent;
        botao.disabled = true;
        botao.textContent = "Enviando…";
        var o = origem();
        post("registrar-lead", {
          nome: nome, email: email, whatsapp: "55" + whats, consentimento: true,
          empresa: form.empresa ? form.empresa.value : "",
          origem: o.origem, campanha: o.campanha, midia: o.midia, conteudo: o.conteudo,
          pagina: document.body.getAttribute("data-pagina"), dispositivo: dispositivo(),
        }).then(function (r) {
          if (!r.ok) throw new Error(String(r.status));
          try { sessionStorage.setItem("hq_nome", nome.split(" ")[0]); } catch (err) { /* ok */ }
          location.href = form.getAttribute("action");
        }).catch(function () {
          erroGeral.classList.add("visivel");
          botao.disabled = false;
          botao.textContent = textoBotao;
        });
      });
    });
  }

  function saudacao() {
    var el = document.querySelector("[data-nome]");
    if (!el) return;
    try { var n = sessionStorage.getItem("hq_nome"); if (n) el.textContent = ", " + n; } catch (e) { /* ok */ }
  }

  document.addEventListener("DOMContentLoaded", function () {
    preencherConfig();
    formularios();
    saudacao();
    registrarVisita();
    pixel();
  });
})();
