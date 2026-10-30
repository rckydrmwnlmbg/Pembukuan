import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { UuidSchema } from '@/lib/schemas/common';
import { defaultUploadStore } from '@/server/upload/service';
import { deleteSupabaseUpload } from '@/server/ledger/supabase-ledger';

const ParamsSchema = z.object({
  uploadId: UuidSchema,
});

const EmptyBodySchema = z.object({}).strict();

export const DELETE = kitchenRoute(
  ['admin', 'maker'],
  EmptyBodySchema,
  async ({ kitchenId, params, user, supabase }) => {
    const { uploadId } = ParamsSchema.parse(params);

    if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
      try {
        await deleteSupabaseUpload(supabase, kitchenId, uploadId);
      } catch {
        defaultUploadStore.deleteUpload(kitchenId, uploadId);
      }
      return Response.json({
        success: true,
        uploadId,
        message: 'Berkas berhasil ditolak dan dihapus dari antrean review.',
      });
    }

    // Fallback in-memory demo
    defaultUploadStore.deleteUpload(kitchenId, uploadId);
    return Response.json({
      success: true,
      uploadId,
      message: 'Berkas berhasil ditolak dan dihapus dari antrean review.',
    });
  },
);
