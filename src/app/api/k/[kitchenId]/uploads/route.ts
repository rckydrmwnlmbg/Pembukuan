import { kitchenRoute } from '@/server/http/kitchen-route';
import {
  BatchUploadBodySchema,
  UploadQueueQuerySchema,
} from '@/lib/schemas/upload';
import { defaultUploadStore } from '@/server/upload/service';
import { uploadLimiter } from '@/server/security/rate-limit';
import { HttpError } from '@/server/http/errors';

export const GET = kitchenRoute(
  ['admin', 'maker', 'approver', 'viewer'],
  UploadQueueQuerySchema,
  async ({ kitchenId, input }) => {
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
  async ({ kitchenId, user, input }) => {
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
