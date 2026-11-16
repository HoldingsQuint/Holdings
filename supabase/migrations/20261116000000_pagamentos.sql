-- Pagamentos vindos do Asaas (webhook). Só a função grava; admin lê.
-- Não guarda CPF nem o corpo bruto do aviso.
create table public.pagamentos (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  asaas_id text not null unique,          -- id da cobrança (pay_...)
  link_id text,                           -- link de pagamento que gerou a cobrança
  status text not null,                   -- status do Asaas (RECEIVED, CONFIRMED, REFUNDED...)
  ultimo_evento text not null,
  valor numeric(12,2),
  forma text,                             -- PIX, CREDIT_CARD, BOLETO
  parcelas int,
  pago_em timestamptz,
  cliente_nome text,
  cliente_email text,
  cliente_telefone text,
  lead_id bigint references public.leads(id) on delete set null,
  email_cliente_enviado boolean not null default false,
  aviso_escritorio_enviado boolean not null default false
);

create index pagamentos_criado_em on public.pagamentos (criado_em desc);

alter table public.pagamentos enable row level security;
revoke all on public.pagamentos from anon;
revoke insert, update, delete, truncate on public.pagamentos from authenticated;

create policy "admin le pagamentos" on public.pagamentos
  for select to authenticated using (privado.eh_admin());
