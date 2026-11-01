import { kitchenRoute } from '@/server/http/kitchen-route';
import { BatchPostUploadBodySchema } from '@/lib/schemas/upload';
import { defaultUploadStore } from '@/server/upload/service';
import { postSupabaseReviewedUpload } from '@/server/ledger/supabase-ledger';
import { HttpError } from '@/server/http/errors';

export const POST = kitchenRoute(
  ['admin', 'maker'],
  BatchPostUploadBodySchema,
  async ({ kitchenId, user, input, supabase }) => {
    let postedCount = 0;
    const errors: Array<{ uploadId: string; message: string }> = [];

    for (const item of input.items) {
      const { uploadId, ...postInput } = item;
      try {
        if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
          try {
            await postSupabaseReviewedUpload(
              supabase,
              kitchenId,
              uploadId,
              user.id,
              postInput,
            );
            postedCount++;
            continue;
          } catch (err: unknown) {
            if (err instanceof HttpError && err.status === 404) {
              defaultUploadStore.postReviewedUpload(
                kitchenId,
                uploadId,
                user.id,
                postInput,
              );
              postedCount++;
              continue;
            }
            throw err;
          }
        }

        defaultUploadStore.postReviewedUpload(
          kitchenId,
          uploadId,
          user.id,
          postInput,
        );
        postedCount++;
      } catch (err: unknown) {
        errors.push({
          uploadId,
          message:
            err instanceof Error ? err.message : 'Gagal memposting transaksi.',
        });
      }
    }

    return Response.json(
      {
        postedCount,
        totalRequested: input.items.length,
        errors,
        success: errors.length === 0,
      },
      { status: errors.length === input.items.length ? 400 : 201 },
    );
  },
);
