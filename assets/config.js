// Configuração do site. Campos vazios aparecem marcados como "pendente" nas páginas.
// A chave do Supabase abaixo é a publicável (feita para ficar no navegador). Nenhuma chave secreta entra aqui.
window.SITE = {
  supabaseUrl: "https://tdvjswuggnusoqosltxa.supabase.co",
  supabaseKey: "sb_publishable_D3nOZGWJ0c6xDdNQxiCafA_3sN8ckSY",

  advogado: "Paulo Quintiliano da Silva",
  oab: "",              // ex.: "OAB/DF 00.000"
  whatsapp: "",         // só números com DDI e DDD, ex.: "5561999999999"
  email: "",            // e-mail de contato exibido na política de privacidade
  escritorio: "",       // nome do escritório responsável pelos dados (controlador)
  cnpj: "",
  cidade: "Brasília/DF",

  // Sessão de Viabilidade
  precoSessao: "",      // ex.: "R$ 497". Conferir com as regras de publicidade da OAB antes de exibir.
  duracaoSessao: "",    // ex.: "cerca de 1 hora"
  linkPagamento: "",    // link de pagamento do Asaas
  linkAgenda: "",       // página de agendamento (ex.: agenda do Google com horários abertos)

  metaPixel: "",        // ID do pixel da Meta, quando o tráfego pago começar
};
