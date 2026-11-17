-- Ficha pré-sessão: o cliente conta o patrimônio e a família antes da Sessão de Viabilidade.
-- Valores só em faixas; sem CPF nem documentos. Só a função grava; admin lê.
create table public.fichas_sessao (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  nome text not null,
  email text not null,
  whatsapp text not null,
  estado_civil text,
  regime_bens text,
  herdeiros int,
  herdeiro_menor boolean,
  filhos_relacoes_diferentes boolean,
  imoveis text,
  valor_imoveis text,
  aluguel boolean,
  empresa boolean,
  empresa_descricao text,
  rural boolean,
  investimentos text,
  objetivos text[] not null default '{}',
  observacoes text,
  consentimento_em timestamptz not null,
  email_enviado boolean not null default false
);

create index fichas_sessao_email on public.fichas_sessao (lower(email));
create index fichas_sessao_criado_em on public.fichas_sessao (criado_em desc);

alter table public.fichas_sessao enable row level security;
revoke all on public.fichas_sessao from anon;
revoke insert, update, delete, truncate on public.fichas_sessao from authenticated;

create policy "admin le fichas" on public.fichas_sessao
  for select to authenticated using (privado.eh_admin());
