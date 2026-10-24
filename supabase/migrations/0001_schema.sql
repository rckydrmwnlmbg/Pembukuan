-- ============================================================================
-- 0001_schema.sql — Skema Tabel Domain MVP Kasdapur (Tanpa Tabel v2)
-- Acuan: PRD.md Bagian 7, SECURITY.md S-02/S-08/S-15, SKILLS.md Bagian 2 & 5,
--        serta keputusan OI-01, OI-03, OI-04, OI-05 di docs/OPEN-ISSUES.md.
-- ============================================================================

create extension if not exists pgcrypto;

-- 1. organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

-- 2. profiles
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 1 and 120),
  created_at timestamptz not null default now()
);

-- 3. kitchens (satu dapur = satu buku kas terisolasi)
create table if not exists public.kitchens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  code text not null check (char_length(trim(code)) between 1 and 32),
  pj_name text not null check (char_length(trim(pj_name)) between 1 and 120),
  admin_fee_default bigint not null default 6500 check (admin_fee_default >= 0),
  high_amount_threshold bigint not null default 25000000 check (high_amount_threshold > 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create index if not exists idx_kitchens_organization_id on public.kitchens(organization_id);

-- 4. kitchen_members (peran per dapur: admin | maker | approver | viewer — OI-03)
create table if not exists public.kitchen_members (
  kitchen_id uuid not null references public.kitchens(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'maker', 'approver', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (kitchen_id, user_id)
);

create index if not exists idx_kitchen_members_user_id on public.kitchen_members(user_id);

-- 5. bank_accounts (tepat satu rekening sumber per dapur — PRD FR-F2.2)
create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens(id) on delete cascade,
  bank_code text not null check (char_length(trim(bank_code)) between 1 and 40),
  label text not null check (char_length(trim(label)) between 1 and 120),
  account_no_enc text not null,
  account_no_hash text not null check (account_no_hash ~ '^[0-9a-f]{64}$'),
  account_no_last4 text not null check (account_no_last4 ~ '^\d{4}$'),
  kind text not null default 'operasional' check (kind in ('operasional', 'va')),
  created_at timestamptz not null default now(),
  unique (kitchen_id)
);

create index if not exists idx_bank_accounts_account_no_hash on public.bank_accounts(account_no_hash);

-- 6. periods (saldo awal disimpan kanonik di opening_balance — OI-04; status MVP: open | locked — OI-01)
create table if not exists public.periods (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens(id) on delete restrict,
  year int not null check (year between 2020 and 2100),
  month int not null check (month between 1 and 12),
  opening_balance bigint not null default 0,
  status text not null default 'open' check (status in ('open', 'locked')),
  locked_at timestamptz,
  locked_by uuid references auth.users(id),
  reopen_reason text check (reopen_reason is null or char_length(reopen_reason) <= 500),
  created_at timestamptz not null default now(),
  unique (kitchen_id, year, month)
);

create index if not exists idx_periods_kitchen_id on public.periods(kitchen_id);

-- 7. uploads (bukti transfer PDF/JPG/PNG — MVP kind: transfer_proof — OI-01)
create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens(id) on delete restrict,
  period_id uuid references public.periods(id) on delete restrict,
  kind text not null default 'transfer_proof' check (kind in ('transfer_proof')),
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 120),
  mime text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'uploaded' check (status in ('uploaded', 'parsed', 'needs_manual', 'failed', 'posted')),
  parser_used text check (parser_used is null or char_length(parser_used) <= 80),
  parse_result jsonb,
  consistency_flags text[] not null default '{}',
  suggested_kitchen_id uuid references public.kitchens(id),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (kitchen_id, sha256, kind)
);

create index if not exists idx_uploads_kitchen_status on public.uploads(kitchen_id, status);

-- 8. categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  parent_id uuid references public.categories(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_categories_organization_id on public.categories(organization_id);

-- 9. counterparty_rules (usulan deskripsi dari hash rekening penerima — PRD FR-F4.2 & SECURITY S-04)
create table if not exists public.counterparty_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  match_account_no_hash text not null check (match_account_no_hash ~ '^[0-9a-f]{64}$'),
  counterparty_name text check (counterparty_name is null or char_length(counterparty_name) <= 120),
  counterparty_bank text check (counterparty_bank is null or char_length(counterparty_bank) <= 60),
  description_template text not null check (char_length(trim(description_template)) between 1 and 500),
  category_id uuid references public.categories(id) on delete set null,
  times_used int not null default 1 check (times_used >= 0),
  last_used_at timestamptz not null default now(),
  unique (organization_id, match_account_no_hash)
);

create index if not exists idx_counterparty_rules_org_hash
  on public.counterparty_rules(organization_id, match_account_no_hash);

-- 10. transactions (uang bigint, tanpa kolom saldo berjalan, dengan parent_transaction_id — OI-01, OI-04, OI-05)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens(id) on delete restrict,
  period_id uuid not null references public.periods(id) on delete restrict,
  parent_transaction_id uuid references public.transactions(id) on delete restrict,
  seq_no int not null check (seq_no > 0),
  tx_date date not null,
  kind text not null check (kind in ('incoming', 'outgoing', 'admin_fee')),
  reference_no text check (reference_no is null or reference_no ~ '^[A-Za-z0-9\-_./]{1,64}$'),
  description text not null check (char_length(trim(description)) between 1 and 500),
  counterparty_account_no_enc text,
  counterparty_account_last4 text check (counterparty_account_last4 is null or counterparty_account_last4 ~ '^\d{4}$'),
  counterparty_name text check (counterparty_name is null or char_length(counterparty_name) <= 120),
  counterparty_bank text check (counterparty_bank is null or char_length(counterparty_bank) <= 60),
  debit bigint not null default 0,
  credit bigint not null default 0,
  note text check (note is null or char_length(note) <= 500),
  category_id uuid references public.categories(id) on delete set null,
  source_upload_id uuid references public.uploads(id) on delete restrict,
  status text not null default 'posted' check (status in ('posted', 'void')),
  version int not null default 1 check (version >= 1),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (debit >= 0 and credit >= 0 and not (debit > 0 and credit > 0)),
  check (
    (kind = 'incoming' and debit > 0 and credit = 0)
    or (kind in ('outgoing', 'admin_fee') and credit > 0 and debit = 0)
  )
);

-- Kunci keunikan (kitchen_id, reference_no, kind) untuk transaksi aktif (PRD FR-F4.3 & bagian 7)
create unique index if not exists idx_transactions_unique_ref_kind
  on public.transactions(kitchen_id, reference_no, kind)
  where reference_no is not null and status <> 'void';

create index if not exists idx_transactions_kitchen_period_order
  on public.transactions(kitchen_id, period_id, tx_date, seq_no);

create index if not exists idx_transactions_parent_id
  on public.transactions(parent_transaction_id)
  where parent_transaction_id is not null;

-- 11. audit_logs (append-only, PRD F9 & SECURITY S-15)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens(id) on delete restrict,
  actor_id uuid references auth.users(id),
  action text not null check (char_length(trim(action)) between 1 and 80),
  entity text not null check (char_length(trim(entity)) between 1 and 80),
  entity_id uuid not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_kitchen_created
  on public.audit_logs(kitchen_id, created_at desc);

-- 12. View saldo berjalan per dapur per periode (security_invoker = true agar RLS selalu berlaku)
create or replace view public.v_period_ledger
with (security_invoker = true)
as
select
  t.id,
  t.kitchen_id,
  t.period_id,
  t.parent_transaction_id,
  t.seq_no,
  t.tx_date,
  t.kind,
  t.reference_no,
  t.description,
  t.counterparty_account_no_enc,
  t.counterparty_account_last4,
  t.counterparty_name,
  t.counterparty_bank,
  t.debit,
  t.credit,
  t.note,
  t.category_id,
  t.source_upload_id,
  t.status,
  t.version,
  t.created_by,
  t.created_at,
  t.updated_at,
  p.opening_balance
    + coalesce(
        sum(case when t.status = 'posted' then t.debit - t.credit else 0 end)
        over (
          partition by t.kitchen_id, t.period_id
          order by t.tx_date asc, t.seq_no asc, t.id asc
          rows between unbounded preceding and current row
        ),
        0
      )::bigint as running_balance
from public.transactions t
join public.periods p
  on p.id = t.period_id
 and p.kitchen_id = t.kitchen_id;
