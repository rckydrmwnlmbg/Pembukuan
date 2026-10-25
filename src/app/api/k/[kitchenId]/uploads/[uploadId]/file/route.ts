import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { UuidSchema } from '@/lib/schemas/common';
import { defaultUploadStore } from '@/server/upload/service';

const EmptyQuerySchema = z.object({}).strict();
const ParamsSchema = z.object({
  uploadId: UuidSchema,
});

export const GET = kitchenRoute(
  ['admin', 'maker', 'approver', 'viewer'],
  EmptyQuerySchema,
  async ({ kitchenId, params }) => {
    const { uploadId } = ParamsSchema.parse(params);
    const fileData = await defaultUploadStore.getUploadFileBytes(
      kitchenId,
      uploadId,
    );

    return new Response(new Uint8Array(fileData.bytes), {
      status: 200,
      headers: {
        'Content-Type': fileData.mime,
        'Cache-Control': 'private, max-age=60',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },
);
