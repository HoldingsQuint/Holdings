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

-- Envio pelo site sem função de borda: o site chama /rest/v1/rpc/enviar_ficha com a chave publicável.
-- Valida tudo aqui; aceita só as origens do site; não devolve nada da tabela.
create or replace function public.enviar_ficha(dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  hdr jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  origem text := hdr->>'origin';
  v_nome text := left(btrim(regexp_replace(coalesce(dados->>'nome', ''), '\s+', ' ', 'g')), 120);
  v_email text := lower(left(btrim(coalesce(dados->>'email', '')), 200));
  v_zap text := regexp_replace(coalesce(dados->>'whatsapp', ''), '\D', '', 'g');
  v_herd int;
  v_obj text[];
begin
  if origem is null or origem not in ('https://holdings.quintiliano.com.br', 'https://holdingsquint.github.io', 'http://localhost:8080') then
    raise exception 'origem' using errcode = '42501';
  end if;
  if coalesce(dados->>'empresa_site', '') <> '' then
    return jsonb_build_object('ok', true); -- isca
  end if;
  if length(v_nome) < 2 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' or length(v_zap) not between 10 and 13
     or coalesce((dados->>'consentimento')::boolean, false) is not true then
    raise exception 'campos' using errcode = '22023';
  end if;
  if exists (select 1 from fichas_sessao where email = v_email and criado_em > now() - interval '2 minutes') then
    return jsonb_build_object('ok', true, 'repetido', true);
  end if;

  v_herd := case when dados->>'herdeiros' ~ '^\d{1,2}$' then (dados->>'herdeiros')::int end;
  select coalesce(array_agg(o), '{}') into v_obj
    from jsonb_array_elements_text(case when jsonb_typeof(dados->'objetivos') = 'array' then dados->'objetivos' else '[]' end) o
    where o in ('sucessao', 'impostos', 'protecao', 'inventario', 'gestao', 'empresa', 'outro');

  insert into fichas_sessao (nome, email, whatsapp, estado_civil, regime_bens, herdeiros, herdeiro_menor,
    filhos_relacoes_diferentes, imoveis, valor_imoveis, aluguel, empresa, empresa_descricao, rural,
    investimentos, objetivos, observacoes, consentimento_em)
  values (
    v_nome, v_email, v_zap,
    case when dados->>'estado_civil' in ('solteiro','casado','uniao_estavel','divorciado','viuvo') then dados->>'estado_civil' end,
    case when dados->>'regime_bens' in ('comunhao_parcial','comunhao_universal','separacao_total','participacao_final','nao_sei') then dados->>'regime_bens' end,
    v_herd,
    case dados->>'herdeiro_menor' when 'sim' then true when 'nao' then false end,
    case dados->>'filhos_relacoes_diferentes' when 'sim' then true when 'nao' then false end,
    case when dados->>'imoveis' in ('0','1','2-5','6-10','10+') then dados->>'imoveis' end,
    case when dados->>'valor_imoveis' in ('ate_1mi','1_3mi','3_10mi','10mi+','nao_informar') then dados->>'valor_imoveis' end,
    case dados->>'aluguel' when 'sim' then true when 'nao' then false end,
    case dados->>'empresa' when 'sim' then true when 'nao' then false end,
    nullif(left(btrim(coalesce(dados->>'empresa_descricao', '')), 500), ''),
    case dados->>'rural' when 'sim' then true when 'nao' then false end,
    case when dados->>'investimentos' in ('nenhum','ate_500mil','500mil_2mi','2mi+','nao_informar') then dados->>'investimentos' end,
    v_obj,
    nullif(left(btrim(coalesce(dados->>'observacoes', '')), 3000), ''),
    now()
  );
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.enviar_ficha(jsonb) from public;
grant execute on function public.enviar_ficha(jsonb) to anon, authenticated;
