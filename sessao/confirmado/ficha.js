// Ficha pré-sessão: grava pela função do banco enviar_ficha. Não passa pelo pixel.
(function () {
  var form = document.getElementById("form-ficha");
  if (!form) return;
  var S = window.SITE;
  var zap = form.whatsapp;
  zap.addEventListener("input", function () {
    var d = zap.value.replace(/\D/g, "").slice(0, 11);
    zap.value = d.length > 6 ? "(" + d.slice(0, 2) + ") " + d.slice(2, d.length - 4) + "-" + d.slice(-4)
      : d.length > 2 ? "(" + d.slice(0, 2) + ") " + d.slice(2) : d;
  });
  function radio(nome) { var r = form.querySelector('input[name="' + nome + '"]:checked'); return r ? r.value : null; }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var erro = document.getElementById("erro-ficha");
    erro.classList.remove("visivel");
    form.querySelectorAll(".invalido").forEach(function (c) { c.classList.remove("invalido"); });

    var nome = form.nome.value.trim(), email = form.email.value.trim(), whats = zap.value.replace(/\D/g, "");
    var ok = true;
    if (nome.length < 2) { form.nome.closest(".campo").classList.add("invalido"); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { form.email.closest(".campo").classList.add("invalido"); ok = false; }
    if (whats.length < 10) { zap.closest(".campo").classList.add("invalido"); ok = false; }
    if (!form.consentimento.checked) { form.consentimento.closest(".consentimento").classList.add("invalido"); ok = false; }
    if (!ok) { erro.textContent = "Confira os campos destacados e o aceite no fim."; erro.classList.add("visivel"); return; }

    var h = form.herdeiros.value === "" ? null : parseInt(form.herdeiros.value, 10);
    var dados = {
      nome: nome, email: email, whatsapp: "55" + whats, empresa_site: form.empresa_site.value,
      estado_civil: form.estado_civil.value, regime_bens: form.regime_bens.value,
      herdeiros: isNaN(h) ? null : h,
      herdeiro_menor: radio("herdeiro_menor"), filhos_relacoes_diferentes: radio("filhos_relacoes_diferentes"),
      imoveis: form.imoveis.value, valor_imoveis: form.valor_imoveis.value,
      aluguel: radio("aluguel"), rural: radio("rural"), empresa: radio("empresa"),
      empresa_descricao: form.empresa_descricao.value,
      investimentos: form.investimentos.value,
      objetivos: Array.prototype.map.call(form.querySelectorAll('input[name="objetivos"]:checked'), function (c) { return c.value; }),
      observacoes: form.observacoes.value,
      consentimento: true,
    };
    var b = form.querySelector('button[type="submit"]');
    b.disabled = true; b.textContent = "Enviando...";
    try {
      // Grava pela função do banco (enviar_ficha), que valida tudo e não devolve dados.
      var r = await fetch(S.supabaseUrl + "/rest/v1/rpc/enviar_ficha", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: S.supabaseKey },
        body: JSON.stringify({ dados: dados }),
      });
      if (!r.ok) throw new Error(r.status);
      // Aviso ao escritório (só o e-mail vai junto; a função confere a ficha no banco).
      fetch(S.supabaseUrl + "/functions/v1/avisar-ficha", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: S.supabaseKey },
        body: JSON.stringify({ email: email }),
      }).catch(function () {});
      form.classList.add("oculto");
      var okBox = document.getElementById("ok-ficha");
      okBox.classList.remove("oculto");
      okBox.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      erro.textContent = "Não conseguimos enviar agora. Confira sua conexão e tente de novo.";
      erro.classList.add("visivel");
      b.disabled = false; b.textContent = "Enviar ficha";
    }
  });
})();
