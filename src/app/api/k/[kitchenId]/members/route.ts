import { kitchenRoute } from '@/server/http/kitchen-route';
import {
  ListMembersQuerySchema,
  AddMemberBodySchema,
  UpdateMemberBodySchema,
  DeleteMemberBodySchema,
} from '@/lib/schemas/members';
import { createAdminClient } from '@/server/supabase/admin';
import { HttpError } from '@/server/http/errors';

export const dynamic = 'force-dynamic';

export const GET = kitchenRoute(
  ['admin', 'maker', 'approver', 'viewer'],
  ListMembersQuerySchema,
  async ({ supabase, user, kitchenId }) => {
    // 1. Jika demo user / in-memory fallback
    if (!supabase || user.id === '00000000-0000-4000-8000-000000000001') {
      return Response.json({
        members: [
          {
            userId: user.id,
            email: 'maker@sintetis.example',
            role: 'admin',
            createdAt: new Date().toISOString(),
          },
        ],
      });
    }

    try {
      const { data: members, error: memErr } = await supabase
        .from('kitchen_members')
        .select('user_id, role, created_at')
        .eq('kitchen_id', kitchenId)
        .order('created_at', { ascending: true });

      if (memErr) {
        throw new HttpError(500, `Gagal memuat anggota: ${memErr.message}`);
      }

      // Ambil daftar email dari auth.admin
      const adminClient = createAdminClient();
      const { data: userData } = await adminClient.auth.admin.listUsers();
      const userMap = new Map((userData?.users || []).map((u) => [u.id, u.email || 'Tanpa email']));

      const serialized = (members || []).map((m) => ({
        userId: m.user_id,
        email: userMap.get(m.user_id) || 'Pengguna Terdaftar',
        role: m.role,
        createdAt: m.created_at,
      }));

      return Response.json({ members: serialized });
    } catch (err: unknown) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(500, 'Terjadi kesalahan saat memuat daftar anggota.');
    }
  },
);

export const POST = kitchenRoute(
  ['admin'],
  AddMemberBodySchema,
  async ({ kitchenId, input, user }) => {
    // Demo session
    if (user.id === '00000000-0000-4000-8000-000000000001') {
      return Response.json({
        success: true,
        message: 'Pengguna berhasil ditambahkan (simulasi demo).',
      });
    }

    const adminClient = createAdminClient();
    const { data: userData, error: userErr } = await adminClient.auth.admin.listUsers();

    if (userErr || !userData) {
      throw new HttpError(500, 'Gagal memeriksa data pengguna di sistem autentikasi.');
    }

    const cleanEmail = input.email.trim().toLowerCase();
    const targetUser = userData.users.find(
      (u) => (u.email || '').trim().toLowerCase() === cleanEmail,
    );

    if (!targetUser) {
      throw new HttpError(
        404,
        `Pengguna dengan email "${input.email}" belum terdaftar. Minta calon anggota/pengawas mendaftarkan akunnya terlebih dahulu melalui menu pendaftaran di aplikasi.`,
      );
    }

    // Masukkan ke kitchen_members
    const { error: insErr } = await adminClient.from('kitchen_members').upsert(
      {
        kitchen_id: kitchenId,
        user_id: targetUser.id,
        role: input.role,
      },
      { onConflict: 'kitchen_id,user_id' },
    );

    if (insErr) {
      throw new HttpError(500, `Gagal menambahkan anggota ke dapur: ${insErr.message}`);
    }

    return Response.json({
      success: true,
      message: `Berhasil menambahkan ${input.email} sebagai ${input.role}.`,
    });
  },
);

export const PATCH = kitchenRoute(
  ['admin'],
  UpdateMemberBodySchema,
  async ({ kitchenId, input, user }) => {
    if (user.id === '00000000-0000-4000-8000-000000000001') {
      return Response.json({ success: true, message: 'Peran berhasil diperbarui.' });
    }

    const adminClient = createAdminClient();
    const { error: updErr } = await adminClient
      .from('kitchen_members')
      .update({ role: input.role })
      .eq('kitchen_id', kitchenId)
      .eq('user_id', input.userId);

    if (updErr) {
      throw new HttpError(500, `Gagal memperbarui peran: ${updErr.message}`);
    }

    return Response.json({ success: true, message: 'Peran anggota berhasil diperbarui.' });
  },
);

export const DELETE = kitchenRoute(
  ['admin'],
  DeleteMemberBodySchema,
  async ({ kitchenId, input, user }) => {
    if (user.id === '00000000-0000-4000-8000-000000000001') {
      return Response.json({ success: true, message: 'Anggota berhasil dihapus.' });
    }

    if (user.id === input.userId) {
      throw new HttpError(400, 'Anda tidak dapat menghapus akun Anda sendiri dari daftar pengelola dapur.');
    }

    const adminClient = createAdminClient();
    const { error: delErr } = await adminClient
      .from('kitchen_members')
      .delete()
      .eq('kitchen_id', kitchenId)
      .eq('user_id', input.userId);

    if (delErr) {
      throw new HttpError(500, `Gagal menghapus anggota: ${delErr.message}`);
    }

    return Response.json({ success: true, message: 'Anggota berhasil dihapus dari dapur ini.' });
  },
);
