# Holdings Quintiliano

Site de captação das holdings (holdings.quintiliano.com.br): checklist gratuito, Sessão de Viabilidade e painel.
HTML, CSS e JS puros, sem build. Banco e funções no Supabase; e-mails pelo Resend; hospedagem no GitHub Pages.

## Páginas

| Caminho | O que é |
|---|---|
| `/` | Landing com o formulário do checklist |
| `/obrigado/` | Depois do formulário (evento `Lead` do pixel). Não indexada |
| `/checklist/` | O checklist interativo (12 perguntas, nada é gravado). Não indexada |
| `/sessao/` | Página da Sessão de Viabilidade, com botão de pagamento |
| `/sessao/confirmado/` | Depois do pagamento: link da agenda e o que separar. Não indexada |
| `/privacidade/` | Política de privacidade (LGPD) |
| `/admin/` | Painel: visitas, contatos, conversão por origem, situação de cada contato, exportar CSV |

Tudo o que falta preencher fica em `assets/config.js` (OAB, WhatsApp, e-mail, escritório, CNPJ, preço, duração, link de pagamento do Asaas, link da agenda, pixel). Campo vazio aparece no site marcado como "pendente". A foto fica nas seções `.foto` de `index.html` e `sessao/index.html`.

Os links são relativos, para funcionar tanto em `holdingsquint.github.io/Holdings/` quanto no domínio final.

## Supabase

Projeto `tdvjswuggnusoqosltxa` (us-east-1). Migrations em `supabase/migrations/` (já aplicadas).

- `leads`: contatos do formulário. `visitas`: contagem por página/origem/aparelho, sem dados pessoais. `admins`: quem lê o painel.
- RLS em tudo, nada público. Gravação só pelas funções (chave de serviço). Leitura só para quem está em `admins`.
- Funções (`verify_jwt: false`, aceitam só as origens de `ALLOWED_ORIGINS`):
  - `registrar-lead`: valida, grava, envia o checklist pelo Resend e põe o contato na lista.
  - `registrar-visita`: conta visita; com `{"ping": true}` só consulta o banco (usado pelo agendamento diário).
  - `asaas-webhook`: recebe os avisos do Asaas (confere o cabeçalho `asaas-access-token`), grava em `pagamentos`, marca o contato com o mesmo e-mail como cliente, manda ao cliente o e-mail com o link de /sessao/confirmado/ e avisa o escritório. Cada e-mail sai uma vez só.
  - `asaas-config`: só admin (botão "Retorno do Asaas" no painel); liga pela API o retorno automático do link de pagamento para /sessao/confirmado/ (a tela do Asaas não tem essa opção).
- `pagamentos`: cobranças do Asaas (sem CPF nem o aviso bruto); só admin lê.
- `.github/workflows/manter-ativo.yml`: ping diário para o projeto gratuito não pausar.

### Segredos das funções (Supabase > Edge Functions > Secrets), colocados pelo dono da conta

| Nome | Valor |
|---|---|
| `RESEND_API_KEY` | chave do Resend (colar direto no Supabase, nunca no código ou na conversa) |
| `RESEND_FROM` | `Holdings Quintiliano <contato@holdings.quintiliano.com.br>` |
| `RESEND_AUDIENCE_ID` | id da lista de contatos no Resend (opcional) |
| `SITE_URL` | `https://holdings.quintiliano.com.br` |
| `RESEND_REPLY_TO` | opcional; padrão `paulo@quintiliano.adv.br` (respostas ao e-mail do checklist) |
| `RESEND_BCC` | opcional; padrão `holdingsquintiliano@gmail.com` (cópia oculta de cada envio) |
| `ASAAS_WEBHOOK_TOKEN` | token inventado pelo dono; o mesmo vai no webhook do Asaas |
| `ASAAS_API_KEY` | chave de API de produção do Asaas (só aqui; nunca no código ou na conversa) |
| `ASAAS_API_URL` | opcional; padrão `https://api.asaas.com/v3` (sandbox: `https://api-sandbox.asaas.com/v3`) |
| `ASAAS_LINK_ID` | opcional; se definido, só cobranças desse link de pagamento são tratadas |
| `AVISO_PAGAMENTO_PARA` | opcional; padrão `paulo@quintiliano.adv.br,holdingsquintiliano@gmail.com` |
| `ALLOWED_ORIGINS` | opcional; padrão: domínio final, github.io e localhost:8080 |

Webhook no Asaas (Integrações > Webhooks): URL `https://tdvjswuggnusoqosltxa.supabase.co/functions/v1/asaas-webhook`, token = `ASAAS_WEBHOOK_TOKEN`, fila sequencial, eventos de Cobrança (recebida, confirmada, estornada).

Sem `RESEND_API_KEY` o formulário funciona e grava, só não envia o e-mail (a página /obrigado já mostra o link do checklist).

### Admins do painel

Cadastrados: octavio.augusto.quintiliano@gmail.com e paulo.quintiliano@gmail.com. Entram por link no e-mail (não cria conta nova) ou por senha, que cada um cria em "Minha senha" dentro do painel.
Para o link funcionar: Authentication > URL Configuration com Site URL e Redirect URLs do site (github.io/Holdings/admin/ e, depois, holdings.quintiliano.com.br/admin/), e SMTP próprio (Resend), porque o envio padrão do Supabase só manda para membros da equipe e no máximo 2 por hora.

Para criar outro:

1. Supabase > Authentication > Users > Add user (e-mail e senha, "auto confirm").
2. SQL: `insert into public.admins (user_id, nome) select id, 'Nome' from auth.users where email = 'email@dominio';`

## Testar localmente

`python3 -m http.server 8080` na raiz e abrir http://localhost:8080. Visitas não são contadas em localhost.
