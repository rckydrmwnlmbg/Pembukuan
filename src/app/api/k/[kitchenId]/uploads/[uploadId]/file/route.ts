import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { UuidSchema } from '@/lib/schemas/common';
import { defaultUploadStore } from '@/server/upload/service';
import { getSupabaseUploadFileBytes } from '@/server/ledger/supabase-ledger';

const EmptyQuerySchema = z.object({}).strict();
const ParamsSchema = z.object({
  uploadId: UuidSchema,
});

export const GET = kitchenRoute(
  ['admin', 'maker', 'approver', 'viewer'],
  EmptyQuerySchema,
  async ({ kitchenId, params, supabase, user }) => {
    const { uploadId } = ParamsSchema.parse(params);

    let fileData: { bytes: Uint8Array; mime: string; displayName: string };

    if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
      try {
        fileData = await getSupabaseUploadFileBytes(supabase, kitchenId, uploadId);
      } catch {
        fileData = await defaultUploadStore.getUploadFileBytes(kitchenId, uploadId);
      }
    } else {
      fileData = await defaultUploadStore.getUploadFileBytes(kitchenId, uploadId);
    }

    const safeFileName = encodeURIComponent(fileData.displayName || 'bukti-transfer');
    return new Response(new Uint8Array(fileData.bytes), {
      status: 200,
      headers: {
        'Content-Type': fileData.mime,
        'Content-Disposition': `inline; filename="${safeFileName}"`,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
);
