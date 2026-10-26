-- ============================================================================
-- 0001_schema.sql â€” Skema Tabel Domain MVP Kasdapur (Tanpa Tabel v2)
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

-- 4. kitchen_members (peran per dapur: admin | maker | approver | viewer â€” OI-03)
create table if not exists public.kitchen_members (
  kitchen_id uuid not null references public.kitchens(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'maker', 'approver', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (kitchen_id, user_id)
);

create index if not exists idx_kitchen_members_user_id on public.kitchen_members(user_id);

-- 5. bank_accounts (tepat satu rekening sumber per dapur â€” PRD FR-F2.2)
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

-- 6. periods (saldo awal disimpan kanonik di opening_balance â€” OI-04; status MVP: open | locked â€” OI-01)
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

-- 7. uploads (bukti transfer PDF/JPG/PNG â€” MVP kind: transfer_proof â€” OI-01)
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

-- 9. counterparty_rules (usulan deskripsi dari hash rekening penerima â€” PRD FR-F4.2 & SECURITY S-04)
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

-- 10. transactions (uang bigint, tanpa kolom saldo berjalan, dengan parent_transaction_id â€” OI-01, OI-04, OI-05)
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

-- 13. View ringkasan persamaan saldo periode per dapur (Saldo awal + Dana masuk - Dana keluar = Saldo akhir)
create or replace view public.v_period_summary
with (security_invoker = true)
as
select
  p.id as period_id,
  p.kitchen_id,
  p.year,
  p.month,
  p.status as period_status,
  p.opening_balance,
  coalesce(sum(case when t.status = 'posted' and t.debit > 0 then t.debit else 0 end), 0)::bigint as total_incoming,
  coalesce(sum(case when t.status = 'posted' and t.credit > 0 then t.credit else 0 end), 0)::bigint as total_outgoing,
  (
    p.opening_balance
    + coalesce(sum(case when t.status = 'posted' then t.debit - t.credit else 0 end), 0)
  )::bigint as closing_balance,
  count(t.id) filter (where t.status = 'posted' and t.debit > 0)::int as incoming_count,
  count(t.id) filter (where t.status = 'posted' and t.credit > 0)::int as outgoing_count
from public.periods p
left join public.transactions t
  on t.period_id = p.id
 and t.kitchen_id = p.kitchen_id
group by p.id, p.kitchen_id, p.year, p.month, p.status, p.opening_balance;

-- ============================================================================
-- 0002_rls.sql â€” Kebijakan Row-Level Security (RLS) untuk Seluruh Tabel Public
-- Acuan: SECURITY.md S-02, SKILLS.md Bagian 5 (rls-migration-author), AGENTS.md #1 & #7.
-- ============================================================================

-- 1. Fungsi pembantu: memeriksa apakah pengguna saat ini memiliki salah satu peran di dapur k
create or replace function public.has_kitchen_role(k uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kitchen_members m
    where m.kitchen_id = k
      and m.user_id = (select auth.uid())
      and m.role = any (roles)
  );
$$;

revoke all on function public.has_kitchen_role(uuid, text[]) from public, anon;
grant execute on function public.has_kitchen_role(uuid, text[]) to authenticated;

-- 2. Fungsi pembantu: memeriksa apakah pengguna adalah anggota salah satu dapur di organisasi org_id
create or replace function public.has_org_role(org_id uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kitchens k
    join public.kitchen_members m on m.kitchen_id = k.id
    where k.organization_id = org_id
      and m.user_id = (select auth.uid())
      and m.role = any (roles)
  );
$$;

revoke all on function public.has_org_role(uuid, text[]) from public, anon;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;

-- ============================================================================
-- Aktifkan & paksa RLS pada SETIAP tabel di skema public (SECURITY.md S-02)
-- ============================================================================

-- organizations
alter table public.organizations enable row level security;
alter table public.organizations force row level security;

create policy org_select on public.organizations
  for select to authenticated
  using (public.has_org_role(id, array['admin','maker','approver','viewer']));

-- profiles
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- kitchens
alter table public.kitchens enable row level security;
alter table public.kitchens force row level security;

create policy kitchens_select on public.kitchens
  for select to authenticated
  using (public.has_kitchen_role(id, array['admin','maker','approver','viewer']));

create policy kitchens_insert on public.kitchens
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['admin']));

create policy kitchens_update on public.kitchens
  for update to authenticated
  using (public.has_kitchen_role(id, array['admin']))
  with check (public.has_kitchen_role(id, array['admin']));

-- kitchen_members
alter table public.kitchen_members enable row level security;
alter table public.kitchen_members force row level security;

create policy km_select on public.kitchen_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_kitchen_role(kitchen_id, array['admin'])
  );

create policy km_insert on public.kitchen_members
  for insert to authenticated
  with check (public.has_kitchen_role(kitchen_id, array['admin']));

create policy km_update on public.kitchen_members
  for update to authenticated
  using (public.has_kitchen_role(kitchen_id, array['admin']))
  with check (public.has_kitchen_role(kitchen_id, array['admin']));

create policy km_delete on public.kitchen_members
  for delete to authenticated
  using (public.has_kitchen_role(kitchen_id, array['admin']));

-- bank_accounts (Sengaja tanpa policy DELETE untuk menjaga integritas rekening dapur)
alter table public.bank_accounts enable row level security;
alter table public.bank_accounts force row level security;

create policy ba_select on public.bank_accounts
  for select to authenticated
  using (public.has_kitchen_role(kitchen_id, array['admin','maker','approver','viewer']));

create policy ba_insert on public.bank_accounts
  for insert to authenticated
  with check (public.has_kitchen_role(kitchen_id, array['admin']));

create policy ba_update on public.bank_accounts
  for update to authenticated
  using (public.has_kitchen_role(kitchen_id, array['admin']))
  with check (public.has_kitchen_role(kitchen_id, array['admin']));

-- periods (Sengaja tanpa policy DELETE)
alter table public.periods enable row level security;
alter table public.periods force row level security;

create policy periods_select on public.periods
  for select to authenticated
  using (public.has_kitchen_role(kitchen_id, array['admin','maker','approver','viewer']));

create policy periods_insert on public.periods
  for insert to authenticated
  with check (public.has_kitchen_role(kitchen_id, array['admin','maker']));

create policy periods_update on public.periods
  for update to authenticated
  using (public.has_kitchen_role(kitchen_id, array['admin','maker']))
  with check (public.has_kitchen_role(kitchen_id, array['admin','maker']));

-- uploads (Sengaja tanpa policy DELETE)
alter table public.uploads enable row level security;
alter table public.uploads force row level security;

create policy uploads_select on public.uploads
  for select to authenticated
  using (public.has_kitchen_role(kitchen_id, array['admin','maker','approver','viewer']));

create policy uploads_insert on public.uploads
  for insert to authenticated
  with check (public.has_kitchen_role(kitchen_id, array['admin','maker']));

create policy uploads_update on public.uploads
  for update to authenticated
  using (public.has_kitchen_role(kitchen_id, array['admin','maker']))
  with check (public.has_kitchen_role(kitchen_id, array['admin','maker']));

-- categories
alter table public.categories enable row level security;
alter table public.categories force row level security;

create policy categories_select on public.categories
  for select to authenticated
  using (public.has_org_role(organization_id, array['admin','maker','approver','viewer']));

create policy categories_insert on public.categories
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['admin','maker']));

create policy categories_update on public.categories
  for update to authenticated
  using (public.has_org_role(organization_id, array['admin','maker']))
  with check (public.has_org_role(organization_id, array['admin','maker']));

-- counterparty_rules
alter table public.counterparty_rules enable row level security;
alter table public.counterparty_rules force row level security;

create policy cr_select on public.counterparty_rules
  for select to authenticated
  using (public.has_org_role(organization_id, array['admin','maker','approver','viewer']));

create policy cr_insert on public.counterparty_rules
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['admin','maker']));

create policy cr_update on public.counterparty_rules
  for update to authenticated
  using (public.has_org_role(organization_id, array['admin','maker']))
  with check (public.has_org_role(organization_id, array['admin','maker']));

-- transactions (Sengaja TIDAK ada policy DELETE: penghapusan ditolak, pembatalan memakai status 'void')
alter table public.transactions enable row level security;
alter table public.transactions force row level security;

create policy tx_select on public.transactions
  for select to authenticated
  using (public.has_kitchen_role(kitchen_id, array['admin','maker','approver','viewer']));

create policy tx_insert on public.transactions
  for insert to authenticated
  with check (public.has_kitchen_role(kitchen_id, array['admin','maker']));

create policy tx_update on public.transactions
  for update to authenticated
  using (public.has_kitchen_role(kitchen_id, array['admin','maker']))
  with check (public.has_kitchen_role(kitchen_id, array['admin','maker']));

-- audit_logs (Hanya SELECT dan INSERT; UPDATE dan DELETE dilarang keras)
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

create policy audit_select on public.audit_logs
  for select to authenticated
  using (public.has_kitchen_role(kitchen_id, array['admin','maker','approver','viewer']));

create policy audit_insert on public.audit_logs
  for insert to authenticated
  with check (public.has_kitchen_role(kitchen_id, array['admin','maker']));
-- ============================================================================
-- 0003_storage.sql â€” Bucket Privat 'uploads' dan Kebijakan Akses per Dapur
-- Acuan: SECURITY.md S-03 (IDOR & Storage).
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uploads',
  'uploads',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'];

create policy "uploads_select_by_kitchen" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'uploads'
    and public.has_kitchen_role(
      ((storage.foldername(name))[1])::uuid,
      array['admin','maker','approver','viewer']
    )
  );

create policy "uploads_insert_by_kitchen" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and public.has_kitchen_role(
      ((storage.foldername(name))[1])::uuid,
      array['admin','maker']
    )
  );

-- Sengaja tidak ada policy update/delete pada storage.objects untuk pengguna.
-- ============================================================================
-- 0004_integrity.sql â€” Kunci Periode, Imutabilitas Audit Log, Trigger Audit,
--                      dan Fungsi Pencarian Aman
-- Acuan: SECURITY.md S-05 & S-15, PRD.md F8 & F9, SKILLS.md Bagian 2 & 5.
-- ============================================================================

-- 1. Kunci periode ditegakkan di lapisan database (SECURITY.md S-15)
create or replace function public.forbid_write_in_locked_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select status into s from public.periods where id = old.period_id;
    if s = 'locked' then
      raise exception 'Periode terkunci' using errcode = 'P0001';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select status into s from public.periods where id = new.period_id;
    if s = 'locked' then
      raise exception 'Periode terkunci' using errcode = 'P0001';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_transactions_period_lock on public.transactions;
create trigger trg_transactions_period_lock
before insert or update or delete on public.transactions
for each row execute function public.forbid_write_in_locked_period();

-- 2. Pembukaan kembali periode terkunci hanya boleh oleh admin dapur dan wajib menyertakan alasan (PRD FR-F8.3 & S-15)
create or replace function public.enforce_period_lock_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'locked' and new.status = 'open' then
    if not public.has_kitchen_role(new.kitchen_id, array['admin']) then
      raise exception 'Hanya admin dapur yang dapat membuka kembali periode terkunci' using errcode = 'P0001';
    end if;
    if new.reopen_reason is null or char_length(trim(new.reopen_reason)) < 5 then
      raise exception 'Alasan pembukaan kembali periode wajib diisi' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_periods_lock_transition on public.periods;
create trigger trg_periods_lock_transition
before update on public.periods
for each row execute function public.enforce_period_lock_transition();

-- 3. Audit log bersifat append-only (SECURITY.md S-15)
revoke update, delete, truncate on public.audit_logs from public, anon, authenticated;

create or replace function public.audit_logs_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs bersifat append-only' using errcode = 'P0001';
end;
$$;

drop trigger if exists trg_audit_logs_immutable on public.audit_logs;
create trigger trg_audit_logs_immutable
before update or delete on public.audit_logs
for each row execute function public.audit_logs_immutable();

-- 4. Trigger pencatatan jejak audit otomatis untuk perubahan tabel transactions & periods (SKILLS.md Bagian 5)
create or replace function public.record_row_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_kitchen_id uuid;
  v_entity_id uuid;
begin
  if tg_op = 'INSERT' then
    v_action := tg_table_name || '.insert';
    v_kitchen_id := new.kitchen_id;
    v_entity_id := new.id;
    insert into public.audit_logs (kitchen_id, actor_id, action, entity, entity_id, before, after)
    values (v_kitchen_id, (select auth.uid()), v_action, tg_table_name, v_entity_id, null, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    v_action := case
      when tg_table_name = 'transactions' and old.status <> 'void' and new.status = 'void' then 'transactions.void'
      when tg_table_name = 'periods' and old.status = 'open' and new.status = 'locked' then 'periods.lock'
      when tg_table_name = 'periods' and old.status = 'locked' and new.status = 'open' then 'periods.reopen'
      else tg_table_name || '.update'
    end;
    v_kitchen_id := new.kitchen_id;
    v_entity_id := new.id;
    insert into public.audit_logs (kitchen_id, actor_id, action, entity, entity_id, before, after)
    values (v_kitchen_id, (select auth.uid()), v_action, tg_table_name, v_entity_id, to_jsonb(old), to_jsonb(new));
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_transactions_audit on public.transactions;
create trigger trg_transactions_audit
after insert or update on public.transactions
for each row execute function public.record_row_audit();

drop trigger if exists trg_periods_audit on public.periods;
create trigger trg_periods_audit
after insert or update on public.periods
for each row execute function public.record_row_audit();

-- 5. Fungsi pencarian transaksi berparameter anti-injeksi filter (SECURITY.md S-05)
create or replace function public.search_transactions(
  p_kitchen uuid,
  p_q text,
  p_limit int default 100
)
returns setof public.transactions
language sql
stable
security invoker
set search_path = ''
as $$
  select t.*
  from public.transactions t
  where t.kitchen_id = p_kitchen
    and (
      t.description ilike '%' || replace(replace(replace(coalesce(p_q, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or coalesce(t.reference_no, '') ilike '%' || replace(replace(replace(coalesce(p_q, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or coalesce(t.counterparty_name, '') ilike '%' || replace(replace(replace(coalesce(p_q, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by t.tx_date asc, t.seq_no asc
  limit least(greatest(p_limit, 1), 500);
$$;

revoke all on function public.search_transactions(uuid, text, int) from public, anon;
grant execute on function public.search_transactions(uuid, text, int) to authenticated;
