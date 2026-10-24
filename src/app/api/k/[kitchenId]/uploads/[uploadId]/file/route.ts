import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { defaultUploadStore } from '@/server/upload/service';

const EmptyQuerySchema = z.object({}).strict();
const UploadIdParamSchema = z.string().min(1, 'ID unggahan tidak valid.');

export const GET = kitchenRoute(
  ['admin', 'maker', 'approver', 'viewer'],
  EmptyQuerySchema,
  async ({ kitchenId, params }) => {
    const uploadId = UploadIdParamSchema.parse(params.uploadId);
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
