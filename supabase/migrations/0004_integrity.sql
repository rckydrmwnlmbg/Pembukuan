-- ============================================================================
-- 0004_integrity.sql — Kunci Periode, Imutabilitas Audit Log, Trigger Audit,
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
