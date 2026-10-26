import { kitchenRoute } from '@/server/http/kitchen-route';
import {
  BatchUploadBodySchema,
  UploadQueueQuerySchema,
} from '@/lib/schemas/upload';
import { defaultUploadStore } from '@/server/upload/service';
import {
  listSupabaseUploads,
  processBatchUploadToSupabase,
} from '@/server/ledger/supabase-ledger';
import { uploadLimiter } from '@/server/security/rate-limit';
import { HttpError } from '@/server/http/errors';

export const GET = kitchenRoute(
  ['admin', 'maker', 'approver', 'viewer'],
  UploadQueueQuerySchema,
  async ({ kitchenId, input, supabase, user }) => {
    // 1. Ambil dari Supabase nyata jika pengguna terotentikasi riil
    if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
      try {
        const uploads = await listSupabaseUploads(
          supabase,
          kitchenId,
          input.status ?? 'all',
        );
        return Response.json({
          kitchenId,
          uploads,
        });
      } catch {
        // Fallback jika tabel belum diinisialisasi
      }
    }

    // 2. Fallback untuk pengguna demo sintetis
    const uploads = defaultUploadStore.listKitchenUploads(
      kitchenId,
      input.status ?? 'all',
    );
    return Response.json({
      kitchenId,
      uploads,
    });
  },
);

export const POST = kitchenRoute(
  ['admin', 'maker'],
  BatchUploadBodySchema,
  async ({ kitchenId, user, input, supabase }) => {
    const rate = await uploadLimiter.limit(`upload:${user.id}`);
    if (!rate.success) {
      throw new HttpError(
        429,
        'Terlalu banyak unggahan dalam waktu singkat. Coba lagi beberapa menit lagi.',
      );
    }

    const decodedFiles = input.files.map((f) => ({
      name: f.name,
      bytes: new Uint8Array(Buffer.from(f.base64, 'base64')),
    }));

    // 1. Simpan ke database Supabase nyata
    if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
      try {
        const uploaded = await processBatchUploadToSupabase(
          supabase,
          kitchenId,
          user.id,
          decodedFiles,
        );

        return Response.json(
          {
            kitchenId,
            uploaded,
          },
          { status: 201 },
        );
      } catch (err: unknown) {
        if (err instanceof Error) {
          throw err;
        }
        throw new HttpError(500, 'Gagal memproses unggahan ke database.');
      }
    }

    // 2. Fallback untuk sesi demo testing
    const uploaded = await defaultUploadStore.processBatchUpload(
      kitchenId,
      user.id,
      decodedFiles,
    );

    return Response.json(
      {
        kitchenId,
        uploaded,
      },
      { status: 201 },
    );
  },
);
