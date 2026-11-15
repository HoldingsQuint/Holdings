# Holdings Quintiliano — guia para o Claude

Site de captação das holdings do escritório do Paulo Quintiliano (pai do Octávio). Fale em português, direto e curto.
Detalhes de páginas, tabelas e segredos no `README.md`.

## Regras
- Publicidade de advocacia: nada de promessa de resultado, economia garantida, comparação com concorrentes ou tom de venda agressiva. Texto informativo e sóbrio. Preço e textos de oferta passam pela validação do Paulo (regras da OAB).
- Holding nunca apresentada como forma de fugir de dívidas.
- RLS em todas as tabelas, sem SELECT público. Nenhuma chave secreta no front-end (só a publicável do Supabase). Chaves do Resend e do Asaas só nos segredos do Supabase, colocadas pelo dono da conta; nunca pedir para colar na conversa.
- Visitas: só números, sem IP. O pixel da Meta (cookies) está ligado e declarado na política de privacidade. Fontes servidas localmente (sem Google Fonts).
- Links relativos em todas as páginas (o site roda em subcaminho no github.io).
- Dados pendentes ficam em `assets/config.js`; não inventar OAB, WhatsApp, preço ou CNPJ.

## Stack
- HTML/CSS/JS puros, sem build. Estilo em `assets/estilo.css` (cores do escudo: marinho, azul, prata).
- Supabase `tdvjswuggnusoqosltxa` pelo MCP (conexão ligada à organização HoldingsQuint). Migrations em `supabase/migrations/` (aplicar com `apply_migration` e manter o arquivo igual). Funções pelo `deploy_edge_function`, `verify_jwt: false`, mandando `index.ts` e `../_shared/...`.
- GitHub Pages publica o `main`. Domínio final: holdings.quintiliano.com.br (DNS no Registro.br).

## Git
- Commit com `git -c user.name="Octávio" -c user.email="octavio.augusto.quintiliano@gmail.com"` e a linha final `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
