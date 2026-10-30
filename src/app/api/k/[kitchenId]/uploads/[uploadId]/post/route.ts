import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { PostUploadReviewBodySchema } from '@/lib/schemas/upload';
import { UuidSchema } from '@/lib/schemas/common';
import { defaultUploadStore } from '@/server/upload/service';
import { postSupabaseReviewedUpload } from '@/server/ledger/supabase-ledger';
import { HttpError } from '@/server/http/errors';

const ParamsSchema = z.object({
  uploadId: UuidSchema,
});

export const POST = kitchenRoute(
  ['admin', 'maker'],
  PostUploadReviewBodySchema,
  async ({ kitchenId, params, user, input, supabase }) => {
    const { uploadId } = ParamsSchema.parse(params);

    // 1. Simpan posting review ke database Supabase jika pengguna nyata
    if (supabase && user.id !== '00000000-0000-4000-8000-000000000001') {
      try {
        const result = await postSupabaseReviewedUpload(
          supabase,
          kitchenId,
          uploadId,
          user.id,
          input,
        );

        return Response.json(
          {
            upload: result.upload,
            createdTransactions: result.createdTransactions.map((r) => ({
              ...r,
              debit: r.debit.toString(),
              credit: r.credit.toString(),
              runningBalance: r.runningBalance.toString(),
            })),
            summary: {
              openingBalance: result.summary.openingBalance.toString(),
              totalIncoming: result.summary.totalIncoming.toString(),
              totalOutgoing: result.summary.totalOutgoing.toString(),
              closingBalance: result.summary.closingBalance.toString(),
              incomingCount: result.summary.incomingCount,
              outgoingCount: result.summary.outgoingCount,
            },
            savedRule: result.savedRule,
          },
          { status: 201 },
        );
      } catch (err: unknown) {
        // Jika bukti transfer tidak ditemukan di database Supabase, coba fallback ke demo store
        if (err instanceof HttpError && err.status === 404) {
          try {
            const fallbackResult = defaultUploadStore.postReviewedUpload(
              kitchenId,
              uploadId,
              user.id,
              input,
            );

            return Response.json(
              {
                upload: fallbackResult.upload,
                createdTransactions: fallbackResult.createdTransactions.map((r) => ({
                  ...r,
                  debit: r.debit.toString(),
                  credit: r.credit.toString(),
                  runningBalance: r.runningBalance.toString(),
                })),
                summary: {
                  openingBalance: fallbackResult.summary.openingBalance.toString(),
                  totalIncoming: fallbackResult.summary.totalIncoming.toString(),
                  totalOutgoing: fallbackResult.summary.totalOutgoing.toString(),
                  closingBalance: fallbackResult.summary.closingBalance.toString(),
                  incomingCount: fallbackResult.summary.incomingCount,
                  outgoingCount: fallbackResult.summary.outgoingCount,
                },
                savedRule: fallbackResult.savedRule,
              },
              { status: 201 },
            );
          } catch {
            throw err;
          }
        }
        throw err;
      }
    }

    // 2. Fallback untuk sesi demo testing
    const result = defaultUploadStore.postReviewedUpload(
      kitchenId,
      uploadId,
      user.id,
      input,
    );

    return Response.json(
      {
        upload: result.upload,
        createdTransactions: result.createdTransactions.map((r) => ({
          ...r,
          debit: r.debit.toString(),
          credit: r.credit.toString(),
          runningBalance: r.runningBalance.toString(),
        })),
        summary: {
          openingBalance: result.summary.openingBalance.toString(),
          totalIncoming: result.summary.totalIncoming.toString(),
          totalOutgoing: result.summary.totalOutgoing.toString(),
          closingBalance: result.summary.closingBalance.toString(),
          incomingCount: result.summary.incomingCount,
          outgoingCount: result.summary.outgoingCount,
        },
        savedRule: result.savedRule,
      },
      { status: 201 },
    );
  },
);
