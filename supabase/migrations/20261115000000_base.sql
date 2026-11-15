-- Base do site das holdings: contatos (leads), visitas e quem administra.
-- Regra: RLS em todas as tabelas, nada público. Gravação só pelas funções (chave de serviço).
-- Leitura só para quem está na tabela admins, logado.

create schema if not exists privado;

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  criado_em timestamptz not null default now()
);

create table public.leads (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  nome text not null check (char_length(nome) between 2 and 120),
  email text not null check (char_length(email) between 5 and 200),
  whatsapp text not null check (char_length(whatsapp) between 8 and 20),
  consentimento_em timestamptz not null,
  origem text,             -- utm_source ou "direto"
  campanha text,           -- utm_campaign
  midia text,              -- utm_medium
  conteudo text,           -- utm_content
  pagina text,             -- página onde se cadastrou
  dispositivo text,        -- celular | computador
  email_enviado boolean not null default false,
  status text not null default 'novo' check (status in ('novo', 'em_contato', 'sessao_agendada', 'cliente', 'descartado')),
  observacao text
);
create index leads_criado_em_idx on public.leads (criado_em desc);
create index leads_email_idx on public.leads (lower(email));

create table public.visitas (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  pagina text not null check (char_length(pagina) <= 120),
  origem text,
  campanha text,
  dispositivo text
);
create index visitas_criado_em_idx on public.visitas (criado_em desc);

-- Quem é admin? Função fora do schema público, sem expor a tabela.
create or replace function privado.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;
revoke all on function privado.eh_admin() from public;
grant usage on schema privado to authenticated;
grant execute on function privado.eh_admin() to authenticated;

alter table public.admins enable row level security;
alter table public.leads enable row level security;
alter table public.visitas enable row level security;

-- Ninguém anônimo lê ou grava nada direto.
revoke all on public.admins, public.leads, public.visitas from anon;
revoke insert, delete, truncate on public.admins, public.leads, public.visitas from authenticated;

create policy "admin ve a propria linha" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

create policy "admin le contatos" on public.leads
  for select to authenticated using ((select privado.eh_admin()));

create policy "admin atualiza status do contato" on public.leads
  for update to authenticated using ((select privado.eh_admin())) with check ((select privado.eh_admin()));

-- O admin só muda status e observação.
revoke update on public.leads from authenticated;
grant update (status, observacao) on public.leads to authenticated;

create policy "admin le visitas" on public.visitas
  for select to authenticated using ((select privado.eh_admin()));
