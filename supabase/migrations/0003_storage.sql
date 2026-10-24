-- ============================================================================
-- 0003_storage.sql — Bucket Privat 'uploads' dan Kebijakan Akses per Dapur
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
