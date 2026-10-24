-- ============================================================================
-- 0002_rls.sql — Kebijakan Row-Level Security (RLS) untuk Seluruh Tabel Public
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
