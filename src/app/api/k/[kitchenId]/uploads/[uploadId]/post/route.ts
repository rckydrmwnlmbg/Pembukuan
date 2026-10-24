import { z } from 'zod';
import { kitchenRoute } from '@/server/http/kitchen-route';
import { PostUploadReviewBodySchema } from '@/lib/schemas/upload';
import { defaultUploadStore } from '@/server/upload/service';

const UploadIdParamSchema = z.string().min(1, 'ID unggahan tidak valid.');

export const POST = kitchenRoute(
  ['admin', 'maker'],
  PostUploadReviewBodySchema,
  async ({ kitchenId, params, user, input }) => {
    const uploadId = UploadIdParamSchema.parse(params.uploadId);

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
