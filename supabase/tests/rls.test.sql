-- ============================================================================
-- supabase/tests/rls.test.sql — Uji Verifikasi RLS, Isolasi Lintas Dapur,
--                               Peran Viewer, Kunci Periode, & Audit Log
-- Acuan: SECURITY.md S-02, S-03, S-05, S-15 & SKILLS.md Bagian 5.
-- ============================================================================

begin;

-- 1. Pemeriksaan global: pastikan TIDAK ADA tabel di skema public tanpa RLS aktif (SECURITY.md S-02)
do $$
declare
  unprotected_count int;
begin
  select count(*)
    into unprotected_count
  from pg_tables
  where schemaname = 'public'
    and not rowsecurity;

  if unprotected_count > 0 then
    raise exception 'SECURITY S-02 GAGAL: Ditemukan % tabel di skema public tanpa RLS aktif', unprotected_count;
  end if;
end $$;

-- 2. Siapkan data uji sintetis:
--    - user_a (maker di Dapur A)
--    - user_b (maker di Dapur B)
--    - user_viewer (viewer di Dapur A)
--    - user_admin (admin di Dapur A)
do $$
declare
  v_user_a uuid := '11111111-1111-4111-8111-111111111111';
  v_user_b uuid := '22222222-2222-4222-8222-222222222222';
  v_user_viewer uuid := '33333333-3333-4333-8333-333333333333';
  v_user_admin uuid := '44444444-4444-4444-8444-444444444444';
  v_org uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_kitchen_a uuid := 'aaaaaaaa-0001-4001-8001-000000000001';
  v_kitchen_b uuid := 'bbbbbbbb-0002-4002-8002-000000000002';
  v_period_a uuid := 'aaaaaaaa-1001-4001-8001-000000000001';
  v_period_b uuid := 'bbbbbbbb-1002-4002-8002-000000000002';
  v_tx_a uuid := 'aaaaaaaa-2001-4001-8001-000000000001';
  v_tx_b uuid := 'bbbbbbbb-2002-4002-8002-000000000002';
begin
  insert into auth.users (id, email) values
    (v_user_a, 'maker.a@sintetis.example'),
    (v_user_b, 'maker.b@sintetis.example'),
    (v_user_viewer, 'viewer.a@sintetis.example'),
    (v_user_admin, 'admin.a@sintetis.example')
  on conflict (id) do nothing;

  insert into public.organizations (id, name)
  values (v_org, 'Yayasan Sintetis Uji RLS');

  insert into public.kitchens (id, organization_id, name, code, pj_name)
  values
    (v_kitchen_a, v_org, 'Dapur Sintetis Alfa', 'ALFA', 'Budi Sintetis'),
    (v_kitchen_b, v_org, 'Dapur Sintetis Beta', 'BETA', 'Siti Sintetis');

  insert into public.kitchen_members (kitchen_id, user_id, role)
  values
    (v_kitchen_a, v_user_a, 'maker'),
    (v_kitchen_a, v_user_viewer, 'viewer'),
    (v_kitchen_a, v_user_admin, 'admin'),
    (v_kitchen_b, v_user_b, 'maker');

  insert into public.periods (id, kitchen_id, year, month, opening_balance, status)
  values
    (v_period_a, v_kitchen_a, 2026, 3, 100000000, 'open'),
    (v_period_b, v_kitchen_b, 2026, 3, 150000000, 'open');

  insert into public.transactions (
    id, kitchen_id, period_id, seq_no, tx_date, kind, reference_no, description, debit, credit, status, created_by
  ) values
    (v_tx_a, v_kitchen_a, v_period_a, 1, '2026-03-02', 'outgoing', '20260302ALFA01', 'Belanja bahan sintetis Alfa', 0, 1500000, 'posted', v_user_a),
    (v_tx_b, v_kitchen_b, v_period_b, 1, '2026-03-02', 'outgoing', '20260302BETA01', 'Belanja bahan sintetis Beta', 0, 2500000, 'posted', v_user_b);
end $$;

-- 3. Uji sebagai user_a (maker di Dapur A)
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

do $$
declare
  v_count_b int;
  v_count_a int;
  v_updated int;
  v_deleted int;
  v_rls_blocked boolean := false;
begin
  -- 3a. user_a tidak boleh melihat transaksi Dapur B
  select count(*) into v_count_b
  from public.transactions
  where kitchen_id = 'bbbbbbbb-0002-4002-8002-000000000002';

  if v_count_b <> 0 then
    raise exception 'SECURITY S-02 GAGAL: user_a dapat membaca % transaksi Dapur B', v_count_b;
  end if;

  -- 3b. user_a hanya melihat transaksi Dapur A
  select count(*) into v_count_a
  from public.transactions
  where kitchen_id = 'aaaaaaaa-0001-4001-8001-000000000001';

  if v_count_a <> 1 then
    raise exception 'SECURITY S-02 GAGAL: user_a seharusnya melihat 1 transaksi Dapur A, dapat %', v_count_a;
  end if;

  -- 3c. user_a tidak boleh INSERT ke Dapur B
  begin
    insert into public.transactions (
      kitchen_id, period_id, seq_no, tx_date, kind, reference_no, description, debit, credit, status, created_by
    ) values (
      'bbbbbbbb-0002-4002-8002-000000000002',
      'bbbbbbbb-1002-4002-8002-000000000002',
      2, '2026-03-03', 'outgoing', '20260303HACK', 'Injeksi lintas dapur', 0, 1000, 'posted',
      '11111111-1111-4111-8111-111111111111'
    );
  exception when insufficient_privilege or check_violation or others then
    v_rls_blocked := true;
  end;

  if not v_rls_blocked then
    raise exception 'SECURITY S-02 GAGAL: user_a berhasil INSERT ke Dapur B';
  end if;

  -- 3d. user_a tidak boleh UPDATE transaksi Dapur B (0 baris terpengaruh)
  update public.transactions
     set credit = 1
   where kitchen_id = 'bbbbbbbb-0002-4002-8002-000000000002';
  get diagnostics v_updated = row_count;

  if v_updated <> 0 then
    raise exception 'SECURITY S-02 GAGAL: user_a berhasil mengubah % baris Dapur B', v_updated;
  end if;

  -- 3e. user_a tidak boleh DELETE transaksi di Dapur A sendiri (tidak ada policy delete)
  delete from public.transactions
   where kitchen_id = 'aaaaaaaa-0001-4001-8001-000000000001';
  get diagnostics v_deleted = row_count;

  if v_deleted <> 0 then
    raise exception 'SECURITY S-02 GAGAL: DELETE pada transactions seharusnya 0 baris, terhapus %', v_deleted;
  end if;
end $$;

-- 3f. Uji Penegakan MFA TOTP AAL2 (FR-F1.1 & SECURITY S-01):
-- Sesi pengguna dengan klaim AAL1 WAJIB ditolak oleh RLS untuk membaca atau menulis data dapur
select set_config('request.jwt.claim.aal', 'aal1', true);

do $$
declare
  v_count_aal1 int;
  v_aal1_blocked boolean := false;
begin
  -- Sesi AAL1 dilarang membaca data dapur
  select count(*) into v_count_aal1
  from public.transactions
  where kitchen_id = 'aaaaaaaa-0001-4001-8001-000000000001';

  if v_count_aal1 <> 0 then
    raise exception 'SECURITY S-01 GAGAL: sesi AAL1 berhasil membaca % transaksi dapur', v_count_aal1;
  end if;

  -- Sesi AAL1 dilarang INSERT data dapur
  begin
    insert into public.transactions (
      kitchen_id, period_id, seq_no, tx_date, kind, reference_no, description, debit, credit, status, created_by
    ) values (
      'aaaaaaaa-0001-4001-8001-000000000001',
      'aaaaaaaa-1001-4001-8001-000000000001',
      99, '2026-03-05', 'outgoing', '20260305AAL1', 'Percobaan tulis sesi AAL1', 0, 10000, 'posted',
      '11111111-1111-4111-8111-111111111111'
    );
  exception when others then
    v_aal1_blocked := true;
  end;

  if not v_aal1_blocked then
    raise exception 'SECURITY S-01 GAGAL: sesi AAL1 berhasil melakukan INSERT transaksi';
  end if;
end $$;

-- Kembalikan sesi ke AAL2: membaca harus diizinkan kembali
select set_config('request.jwt.claim.aal', 'aal2', true);

do $$
declare
  v_count_aal2 int;
begin
  select count(*) into v_count_aal2
  from public.transactions
  where kitchen_id = 'aaaaaaaa-0001-4001-8001-000000000001';

  if v_count_aal2 <> 1 then
    raise exception 'SECURITY S-01 GAGAL: sesi AAL2 seharusnya dapat membaca 1 transaksi, dapat %', v_count_aal2;
  end if;
end $$;

-- 4. Uji S-05: search_transactions tahan upaya injeksi string filter/SQL
do $$
declare
  v_leak_count int;
begin
  select count(*) into v_leak_count
  from public.search_transactions(
    'aaaaaaaa-0001-4001-8001-000000000001',
    'x%,kitchen_id.neq.00000000-0000-0000-0000-000000000000',
    100
  )
  where kitchen_id <> 'aaaaaaaa-0001-4001-8001-000000000001';

  if v_leak_count <> 0 then
    raise exception 'SECURITY S-05 GAGAL: search_transactions membocorkan data dapur lain';
  end if;

  perform count(*)
  from public.search_transactions(
    'aaaaaaaa-0001-4001-8001-000000000001',
    '''; drop table transactions; --',
    100
  );
end $$;

-- 5. Uji sebagai user_viewer (role viewer di Dapur A): boleh baca, dilarang tulis
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);

do $$
declare
  v_count_a int;
  v_viewer_blocked boolean := false;
begin
  select count(*) into v_count_a
  from public.transactions
  where kitchen_id = 'aaaaaaaa-0001-4001-8001-000000000001';

  if v_count_a <> 1 then
    raise exception 'SECURITY S-02 GAGAL: viewer di Dapur A tidak dapat membaca transaksi Dapur A';
  end if;

  begin
    insert into public.transactions (
      kitchen_id, period_id, seq_no, tx_date, kind, reference_no, description, debit, credit, status, created_by
    ) values (
      'aaaaaaaa-0001-4001-8001-000000000001',
      'aaaaaaaa-1001-4001-8001-000000000001',
      2, '2026-03-04', 'outgoing', '20260304VIEW', 'Percobaan tulis viewer', 0, 50000, 'posted',
      '33333333-3333-4333-8333-333333333333'
    );
  exception when insufficient_privilege or others then
    v_viewer_blocked := true;
  end;

  if not v_viewer_blocked then
    raise exception 'SECURITY S-02 GAGAL: role viewer berhasil melakukan INSERT transaksi';
  end if;
end $$;

-- 6. Uji S-15: Kunci periode menolak perubahan transaksi bahkan dari admin, dan audit_logs bersifat append-only
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);

do $$
declare
  v_locked_blocked boolean := false;
  v_audit_blocked boolean := false;
begin
  update public.periods
     set status = 'locked',
         locked_at = now(),
         locked_by = '44444444-4444-4444-8444-444444444444'
   where id = 'aaaaaaaa-1001-4001-8001-000000000001';

  begin
    update public.transactions
       set description = 'Ubah saat periode terkunci'
     where id = 'aaaaaaaa-2001-4001-8001-000000000001';
  exception when sqlstate 'P0001' then
    v_locked_blocked := true;
  end;

  if not v_locked_blocked then
    raise exception 'SECURITY S-15 GAGAL: transaksi pada periode locked berhasil diubah';
  end if;

  begin
    delete from public.audit_logs
     where kitchen_id = 'aaaaaaaa-0001-4001-8001-000000000001';
  exception when others then
    v_audit_blocked := true;
  end;

  if not v_audit_blocked then
    raise exception 'SECURITY S-15 GAGAL: audit_logs berhasil dihapus';
  end if;
end $$;

rollback;
